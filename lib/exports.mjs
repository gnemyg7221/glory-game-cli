import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SKIP = new Set(['.git', 'node_modules', 'library', 'temp', 'build']);

function inputFiles(root, result = []) {
    if (!existsSync(root)) return result;
    for (const item of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (SKIP.has(item.name)) continue;
        const path = join(root, item.name);
        if (item.isDirectory()) inputFiles(path, result);
        else if (item.isFile()) result.push(path);
    }
    return result;
}

export function exportFingerprint(project, buildConfig) {
    const config = structuredClone(buildConfig);
    // Creator can generate a new random key for each invocation. Only an explicitly
    // configured key is passed in via the caller's fingerprintKey field.
    if (config.packages?.native) config.packages.native.xxteaKey = config.fingerprintKey || 'generated';
    const hash = createHash('sha256').update(JSON.stringify(config));
    const files = [
        ...['assets', 'settings', 'extensions'].flatMap((name) => inputFiles(join(project, name))),
        ...['package.json', 'package-lock.json', 'tsconfig.json'].map((name) => join(project, name)),
    ].filter((path) => existsSync(path) && relative(project, path) !== 'settings/v2/packages/information.json');
    for (const path of files) hash.update(relative(project, path)).update('\0').update(readFileSync(path)).update('\0');
    return hash.digest('hex');
}

function statePath(project, outputPath) {
    const key = createHash('sha256').update(resolve(outputPath)).digest('hex').slice(0, 16);
    return join(project, 'build', 'glory-cli', 'exports', key + '.json');
}

const REQUIRED = [
    'data/main.js', 'data/assets', 'proj/gradlew', 'proj/settings.gradle',
    'proj/gradle.properties', 'proj/cfg.cmake', 'proj/build.gradle',
    'proj/gradle/wrapper/gradle-wrapper.properties',
];

export function canReuseExport(project, outputPath, buildConfig) {
    if (REQUIRED.some((path) => !existsSync(join(outputPath, path)))) return false;
    if (buildConfig.packages?.native?.encrypted) {
        if (!inputFiles(join(outputPath, 'data')).some((path) => path.endsWith('.jsc'))) return false;
    }
    let state;
    try { state = JSON.parse(readFileSync(statePath(project, outputPath), 'utf8')); } catch { return false; }
    return state.fingerprint === exportFingerprint(project, buildConfig);
}

export function recordExport(project, outputPath, buildConfig) {
    const path = statePath(project, outputPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
        outputPath: resolve(outputPath), fingerprint: exportFingerprint(project, buildConfig),
    }, null, 2) + '\n');
}
