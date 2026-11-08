import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ensureSdkSubmodule, lfsPointers, runSdkGit, verifySdkFiles } from '../lib/sdk.mjs';
import { canReuseExport, recordExport } from '../lib/exports.mjs';
import { openAndroidStudio } from '../lib/studio.mjs';
import { ensureIntegrationBranch, INTEGRATION_BRANCH } from '../lib/branch.mjs';
import { certificateMd5, gameCenterSecretCheck, requiredIntegrationFailures } from '../bin/glory-game.mjs';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'glory-onboard-tests-')));
console.log('测试文件已保留：' + root);

function write(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
}

function git(repo, ...args) {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
}

function repository(name) {
    const path = join(root, name);
    mkdirSync(path, { recursive: true });
    git(path, 'init', '-q');
    git(path, 'config', 'user.name', 'CLI test');
    git(path, 'config', 'user.email', 'cli-test@example.invalid');
    return path;
}

function gameRepository(name) {
    const path = repository(name);
    write(join(path, 'game.txt'), 'base game');
    git(path, 'add', 'game.txt');
    git(path, 'commit', '-qm', 'base game');
    return path;
}

test('接入固定使用 feature/integrate_ad_sdk，创建分支时保留暂存及未提交文件', () => {
    const project = gameRepository('branch-create');
    const head = git(project, 'rev-parse', 'HEAD');
    write(join(project, 'staged.txt'), 'staged change');
    git(project, 'add', 'staged.txt');
    write(join(project, 'untracked.txt'), 'untracked change');
    const status = git(project, 'status', '--porcelain');
    assert.equal(INTEGRATION_BRANCH, 'feature/integrate_ad_sdk');
    assert.equal(ensureIntegrationBranch(project).action, 'create');
    assert.equal(git(project, 'branch', '--show-current'), INTEGRATION_BRANCH);
    assert.equal(git(project, 'rev-parse', 'HEAD'), head);
    assert.equal(git(project, 'status', '--porcelain'), status);
    assert.equal(ensureIntegrationBranch(project).action, 'reuse');
});

test('接入预演不创建或切换分支，已有同提交接入分支可直接复用', () => {
    const project = gameRepository('branch-preview');
    const current = git(project, 'branch', '--show-current');
    const branches = git(project, 'branch', '--format=%(refname)');
    assert.equal(ensureIntegrationBranch(project, { 'dry-run': true }).action, 'create');
    assert.equal(git(project, 'branch', '--show-current'), current);
    assert.equal(git(project, 'branch', '--format=%(refname)'), branches);
    git(project, 'branch', INTEGRATION_BRANCH);
    assert.equal(ensureIntegrationBranch(project).action, 'switch');
    assert.equal(git(project, 'branch', '--show-current'), INTEGRATION_BRANCH);
});

test('已有接入分支提交不同则停止，保留两边提交和当前工作区', () => {
    const project = gameRepository('branch-different');
    git(project, 'branch', INTEGRATION_BRANCH);
    const target = git(project, 'rev-parse', INTEGRATION_BRANCH);
    write(join(project, 'new-game.txt'), 'later game commit');
    git(project, 'add', 'new-game.txt');
    git(project, 'commit', '-qm', 'later game');
    const current = git(project, 'branch', '--show-current');
    const head = git(project, 'rev-parse', 'HEAD');
    assert.throws(() => ensureIntegrationBranch(project), /当前提交不同/);
    assert.equal(git(project, 'branch', '--show-current'), current);
    assert.equal(git(project, 'rev-parse', 'HEAD'), head);
    assert.equal(git(project, 'rev-parse', INTEGRATION_BRANCH), target);
    assert.equal(readFileSync(join(project, 'new-game.txt'), 'utf8'), 'later game commit');
});

test('密钥可以来自 yaml 或环境变量，且检查输出不泄漏密钥', () => {
    const secret = 'private-test-value';
    const configured = gameCenterSecretCheck({ game: { appSecret: secret } }, {});
    assert.equal(configured.status, 'pass');
    assert.ok(!configured.message.includes(secret));
    assert.equal(gameCenterSecretCheck({ game: {} }, { GLORY_GAME_CENTER_APP_SECRET: secret }).status, 'pass');
    assert.equal(gameCenterSecretCheck({ game: { appSecret: 'REQUIRED' } }, {}).status, 'warn');
});

test('appId、appKey 和 LFS 异常都会阻止接入成功', () => {
    const ids = ['config.app-id', 'config.app-key', 'glory.sdk-files'];
    const checks = [...ids.map((id) => ({ id, status: 'warn' })), { id: 'java.shell-jdk', status: 'warn' }];
    assert.deepEqual(requiredIntegrationFailures({ checks }).map((item) => item.id), ids);
});

const hasLfs = spawnSync('git', ['lfs', 'version'], { stdio: 'ignore' }).status === 0;

test('从同版本本机 SDK 复制源码和 LFS，保持正式远程地址，重复接入无需联网', { skip: !hasLfs }, () => {
    const source = repository('sdk-source');
    const remote = 'git@example.invalid:test/sdk.git';
    const bytes = Buffer.from('PK\u0003\u0004local SDK binary for regression test');
    const oid = createHash('sha256').update(bytes).digest('hex');
    const pointer = 'version https://git-lfs.github.com/spec/v1\noid sha256:' + oid + '\nsize ' + bytes.length + '\n';
    write(join(source, '.gitattributes'), 'libs/*.aar filter=lfs diff=lfs merge=lfs -text\n');
    write(join(source, 'build.gradle'), '// SDK fixture\n');
    write(join(source, 'libs/sdk.aar'), pointer);
    git(source, '-c', 'filter.lfs.process=', '-c', 'filter.lfs.clean=', '-c', 'filter.lfs.required=false', 'add', '.');
    git(source, 'commit', '-qm', 'SDK fixture');
    const commit = git(source, 'rev-parse', 'HEAD');
    git(source, 'remote', 'add', 'origin', remote);
    write(join(source, '.git/lfs/objects', oid.slice(0, 2), oid.slice(2, 4), oid), bytes);
    write(join(source, 'libs/sdk.aar'), bytes);

    const game = repository('game');
    write(join(game, 'package.json'), '{"creator":{"version":"3.8.6"}}');
    git(game, 'add', 'package.json');
    git(game, 'commit', '-qm', 'game');
    const config = { sdk: {
        submodulePath: 'native/engine/android/glory-adsdk', submoduleUrl: remote, commit,
    } };
    const options = { 'sdk-source': source, 'sdk-timeout-seconds': 2 };
    const oldSsh = process.env.GIT_SSH_COMMAND;
    process.env.GIT_SSH_COMMAND = 'false';
    try {
        ensureSdkSubmodule(game, config, options);
        const target = join(game, config.sdk.submodulePath);
        assert.equal(git(target, 'rev-parse', 'HEAD'), commit);
        assert.equal(git(target, 'remote', 'get-url', 'origin'), remote);
        assert.deepEqual(readFileSync(join(target, 'libs/sdk.aar')), bytes);
        assert.equal(lfsPointers(target, commit).length, 1);
        assert.ok(readFileSync(join(game, '.gitmodules'), 'utf8').includes(remote));
        const gitDir = git(target, 'rev-parse', '--absolute-git-dir');
        assert.equal(existsSync(join(gitDir, 'objects/info/alternates')), false);
        git(target, 'config', 'url.ssh://git@rewritten.invalid/.insteadOf', 'git@example.invalid:');
        ensureSdkSubmodule(game, config, options);
        assert.equal(git(target, 'status', '--porcelain'), '');

        write(join(target, 'libs/sdk.aar'), pointer);
        assert.throws(() => verifySdkFiles(target, commit), /不能用指针文件编译/);
        write(join(target, 'libs/sdk.aar'), 'user modification');
        assert.throws(() => ensureSdkSubmodule(game, config, options), /未提交修改/);
        assert.equal(readFileSync(join(target, 'libs/sdk.aar'), 'utf8'), 'user modification');
    } finally {
        if (oldSsh === undefined) Reflect.deleteProperty(process.env, 'GIT_SSH_COMMAND');
        else process.env.GIT_SSH_COMMAND = oldSsh;
    }
});

test('Git 超时会返回明确错误并保留已有文件', () => {
    const fakeBin = join(root, 'fake-bin');
    write(join(fakeBin, 'git'), '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n');
    const result = spawnSync('/bin/chmod', ['+x', join(fakeBin, 'git')]);
    assert.equal(result.status, 0);
    const oldPath = process.env.PATH;
    process.env.PATH = fakeBin + ':' + oldPath;
    try {
        assert.throws(() => runSdkGit(root, ['fetch'], { timeoutMs: 100, label: '下载 SDK' }), /超时.*已保留/);
        assert.ok(existsSync(join(fakeBin, 'git')));
    } finally {
        process.env.PATH = oldPath;
    }
});

function exportFixture(name, encrypted = false) {
    const project = join(root, name);
    const output = join(project, 'build/android');
    for (const path of ['data/main.js', 'data/assets/a.json', 'proj/gradlew', 'proj/settings.gradle',
        'proj/gradle.properties', 'proj/cfg.cmake', 'proj/build.gradle', 'proj/gradle/wrapper/gradle-wrapper.properties']) {
        write(join(output, path), 'fixture');
    }
    write(join(project, 'assets/game.ts'), 'initial game');
    write(join(project, 'settings/v2/packages/information.json'), '{}');
    const config = { packages: { native: { encrypted, xxteaKey: 'random' } } };
    return { project, output, config };
}

test('首次导出记录可复用，资源或构建配置变化会重新导出', () => {
    const { project, output, config } = exportFixture('export-inputs');
    assert.equal(canReuseExport(project, output, config), false);
    recordExport(project, output, config);
    assert.equal(canReuseExport(project, output, config), true);
    write(join(project, 'native/engine/android/app/config'), 'host-only change');
    write(join(project, 'settings/v2/packages/information.json'), '{"account":"other"}');
    assert.equal(canReuseExport(project, output, config), true);
    write(join(project, 'assets/game.ts'), 'changed game');
    assert.equal(canReuseExport(project, output, config), false);
    recordExport(project, output, config);
    assert.equal(canReuseExport(project, output, { ...config, startScene: 'different' }), false);
});

test('随机加密 key 不导致重复导出，但显式 key 和加密产物仍受检查', () => {
    const { project, output, config } = exportFixture('export-encryption', true);
    recordExport(project, output, config);
    assert.equal(canReuseExport(project, output, config), false);
    write(join(output, 'data/game.jsc'), 'encrypted script');
    assert.equal(canReuseExport(project, output, config), true);
    assert.equal(canReuseExport(project, output, { packages: { native: { encrypted: true, xxteaKey: 'another random' } } }), true);
    assert.equal(canReuseExport(project, output, { ...config, fingerprintKey: 'explicit new key' }), false);
});

test('自动打开准确的 Studio 工程，支持空格路径、预演和 no-open', () => {
    const { output } = exportFixture('project with spaces');
    const path = join(output, 'proj');
    const calls = [];
    const opener = (...args) => { calls.push(args); return { status: 0 }; };
    assert.equal(openAndroidStudio(path, { opener }), true);
    assert.deepEqual(calls[0].slice(0, 2), ['/usr/bin/open', ['-a', 'Android Studio', path]]);
    openAndroidStudio(path, { opener, 'no-open': true });
    openAndroidStudio(path, { opener, 'dry-run': true });
    assert.equal(calls.length, 1);
    assert.throws(() => openAndroidStudio(root, { opener }), /不是完整/);
    assert.throws(() => openAndroidStudio(path, { opener: () => ({ status: 1, stderr: 'app unavailable' }) }), /工程已生成/);
});

test('OPPO 签名是证书 MD5，去掉冒号并小写', () => {
    const pem = readFileSync(new URL('./fixtures/oppo-certificate.pem', import.meta.url));
    assert.equal(certificateMd5(pem), '9170af2cff3532e0d5ef8e386a922264');
});
