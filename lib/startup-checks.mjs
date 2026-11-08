import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function files(root) {
    if (!existsSync(root)) return [];
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
    });
}

// Static candidates only; never rewrite a game's TypeScript or infer runtime success.
export function inspectStartupSources(project) {
    const all = files(join(project, 'assets'));
    const bundles = new Set(['internal', 'main', 'resources', 'start-scene']);
    for (const path of all.filter((name) => name.endsWith('.meta'))) {
        try {
            const meta = JSON.parse(readFileSync(path, 'utf8'));
            if (meta.isBundle) bundles.add(meta.bundleName || path.slice(0, -5).split('/').at(-1));
        } catch { /* Creator reports malformed metadata separately. */ }
    }
    const checks = [];
    for (const path of all.filter((name) => /\.[jt]s$/.test(name) && !name.endsWith('.d.ts'))) {
        const text = readFileSync(path, 'utf8');
        // Keep offsets/newlines while excluding comments to reduce false positives.
        const source = text.replace(/\/\*[\s\S]*?\*\//g, (value) => value.replace(/[^\n]/g, ' '))
            .replace(/^\s*\/\/.*$/gm, (value) => ' '.repeat(value.length));
        const location = (offset) => `${relative(project, path)}:${source.slice(0, offset).split('\n').length}`;
        const paths = /\bloadBundle\s*\(\s*['"]([^'"]+)['"]|\bbundle\s*:\s*['"]([^'"]+)['"]/g;
        for (const match of source.matchAll(paths)) {
            const name = match[1] || match[2];
            const actual = [...bundles].find((bundle) => bundle.toLowerCase() === name.toLowerCase());
            if (actual && actual !== name) checks.push({
                id: 'startup.bundle-case', status: 'fail', path, line: source.slice(0, match.index).split('\n').length,
                message: `${location(match.index)} 引用资源包 ${name}，实际为 ${actual}；Android 区分大小写。请核对游戏加载代码。`,
            });
        }
        const imports = /\b(?:import|export)\s+[^;\n]*?\bfrom\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
        for (const match of source.matchAll(imports)) {
            const name = match[1] || match[2];
            if (name !== 'js-base64') continue;
            checks.push({
                id: 'startup.bare-base64', status: 'warn', path, line: source.slice(0, match.index).split('\n').length,
                message: `${location(match.index)} 使用裸模块 js-base64；Creator 2.4 原生包可能无法解析。请确认导出包含该模块，或随 assets 保留同版本实现和许可证。`,
            });
        }
    }
    return checks;
}

export function classifyStartupLog(log, expectedScene) {
    const failures = [];
    for (const line of log.split(/\r?\n/)) {
        if (/Cannot find module|Bundle:.*load error|Read file failed:.*config\.|FATAL EXCEPTION|Fatal signal|TypeError:|ReferenceError:/.test(line)) failures.push(line.trim());
    }
    const escaped = String(expectedScene || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reachedScene = Boolean(expectedScene && new RegExp(`LoadScene ${escaped}:`).test(log));
    return { status: failures.length ? 'fail' : reachedScene ? 'pass' : 'review', reachedScene, failures };
}
