import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { copyLauncherIcons, discoverGameIcon, inspectLauncherIcons, LAUNCHER_MIPMAPS, resolveGameIconPath } from '../lib/icons.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');
function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'glory-icons-'));
    const path = join(root, 'other/logo/logo500.png');
    mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, png);
    return { root, config: { game: { icon: 'other/logo/logo500.png' } } };
}

test('发现已有品牌图，缺失配置路径明确报错，doctor 不将默认图标视为通过', () => {
    const { root, config } = fixture();
    assert.equal(discoverGameIcon(root), config.game.icon);
    assert.throws(() => resolveGameIconPath(root, { game: { icon: 'assets/icon/ic_launcher.png' } }), /图标不存在/);
    assert.throws(() => resolveGameIconPath(root, {}), /缺少 game.icon/);
    assert.equal(inspectLauncherIcons(root, { game: { icon: 'missing.png' } }, [join(root, 'res')])[0].status, 'fail');
    writeFileSync(join(root, 'bad.png'), 'not a PNG');
    assert.throws(() => resolveGameIconPath(root, { game: { icon: 'bad.png' } }), /有效 PNG/);
});

test('2.4 模板和生成工程均同步，预演不写入，重复同步保留缓存与旧图备份', () => {
    const { root, config } = fixture();
    const roots = [join(root, 'build-templates/jsb-link/res'), join(root, 'build/jsb-link/res')];
    assert.equal(copyLauncherIcons(root, config, roots, true).length, 10);
    assert.equal(existsSync(roots[0]), false);
    mkdirSync(join(roots[0], 'mipmap-mdpi'), { recursive: true });
    writeFileSync(join(roots[0], 'mipmap-mdpi/ic_launcher.png'), 'old icon');
    assert.equal(copyLauncherIcons(root, config, roots).length, 10);
    for (const target of roots) for (const density of LAUNCHER_MIPMAPS) {
        assert.deepEqual(readFileSync(join(target, density, 'ic_launcher.png')), png);
    }
    const backups = join(root, 'build/glory-cli/backups');
    const names = readdirSync(backups);
    assert.equal(copyLauncherIcons(root, config, roots).length, 0);
    assert.deepEqual(readdirSync(backups), names);
    assert.ok(inspectLauncherIcons(root, config, roots).every((check) => check.status === 'pass'));
});
