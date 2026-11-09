import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export const LAUNCHER_MIPMAPS = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];

export function discoverGameIcon(project) {
    const candidates = ['assets/icon/ic_launcher.png',
        'other/logo/logo500.png', 'other/logo/logo320.png', 'other/logo/logo256.png', 'other/logo/logo.png',
        'logo/logo320.png', 'logo/logo256.png', 'logo/logo.png', 'settings/logo-diy.png'];
    return candidates.find((path) => {
        try { return Boolean(resolveGameIconPath(project, { game: { icon: path } })); } catch { return false; }
    }) || null;
}

export function resolveGameIconPath(project, config) {
    const raw = config?.game?.icon || config?.sdk?.icon;
    if (!raw || String(raw).startsWith('REQUIRED')) throw new Error('缺少 game.icon，请配置游戏实际桌面图标的 PNG 路径。');
    const path = isAbsolute(raw) ? raw : resolve(project, raw);
    if (!existsSync(path) || !statSync(path).isFile()) throw new Error('桌面图标不存在，请修正 game.icon：' + path);
    const bytes = readFileSync(path);
    if (!/\.png$/i.test(path) || bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('桌面图标必须是有效 PNG：' + path);
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || width !== height) throw new Error(`桌面图标必须为正方形，实际 ${width}×${height}：${path}`);
    return path;
}

export function copyLauncherIcons(project, config, roots, dryRun = false) {
    const source = resolveGameIconPath(project, config);
    const bytes = readFileSync(source);
    const backupRoot = join(project, 'build/glory-cli/backups', 'icons-' + Date.now() + '-' + process.hrtime.bigint());
    const changed = [];
    for (const root of new Set(roots.map((path) => resolve(path)))) {
        for (const density of LAUNCHER_MIPMAPS) {
            const dest = join(root, density, 'ic_launcher.png');
            if (existsSync(dest) && readFileSync(dest).equals(bytes)) continue;
            changed.push(dest);
            if (dryRun) continue;
            if (existsSync(dest)) {
                const backup = join(backupRoot, relative(project, dest));
                mkdirSync(dirname(backup), { recursive: true });
                copyFileSync(dest, backup);
            }
            mkdirSync(dirname(dest), { recursive: true });
            copyFileSync(source, dest);
        }
    }
    return changed;
}

export function inspectLauncherIcons(project, config, roots) {
    let source;
    try { source = resolveGameIconPath(project, config); }
    catch (error) { return [{ id: 'config.icon-source', status: 'fail', message: error.message }]; }
    const bytes = readFileSync(source);
    const paths = roots.flatMap((root) => LAUNCHER_MIPMAPS.map((density) => join(root, density, 'ic_launcher.png')));
    const mismatch = paths.filter((path) => !existsSync(path) || !readFileSync(path).equals(bytes));
    return [{ id: 'config.icon-source', status: 'pass', message: '桌面图标源文件有效：' + source },
        { id: 'config.icon-resources', status: mismatch.length ? 'warn' : 'pass',
            message: mismatch.length ? `${mismatch.length} 个 Android 图标资源未同步，请运行 glory-game sync。` : 'Android launcher 图标与配置源文件一致' }];
}
