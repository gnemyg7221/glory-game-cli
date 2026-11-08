import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, cpSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyCreator2Host, creator2BuildArgument, isCreator2Version } from '../lib/cocos2.mjs';
import { prepareCreator2Environment } from '../lib/cocos2-environment.mjs';
import { inspectStartupSources, classifyStartupLog } from '../lib/startup-checks.mjs';
import { deviceSmoke } from '../lib/device-smoke.mjs';

const template = fileURLToPath(new URL('./fixtures/creator2-template', import.meta.url));

const config = {
    game: {
        name: '我逆袭特牛',
        packageName: 'com.evolution.transportking.app.nearme.gamecenter',
        versionCode: 1,
        versionName: '1.0.0',
        orientation: 'portrait',
        appKey: 'fixture-key',
        appId: '37145911',
        appSecret: 'fixture-secret',
    },
    cocos: { apiLevel: 30, appABIs: ['arm64-v8a', 'armeabi-v7a'], xxteaKey: 'fixture-xxtea' },
    android: { compileSdk: 30, targetSdk: 30, buildToolsVersion: '30.0.3' },
};

test('Creator 2.4 宿主补丁可以重复执行', () => {
    assert.equal(isCreator2Version('2.4.15'), true);
    assert.equal(isCreator2Version('3.8.6'), false);
    const argument = creator2BuildArgument(config, 'aeab303f-7b6b-4610-a9bd-859db03364b6', true);
    assert.match(argument, /packageName=com\.evolution\.transportking\.app\.nearme\.gamecenter/);
    assert.match(argument, /template=link/);

    const root = mkdtempSync(join(tmpdir(), 'glory-cocos2-'));
    const project = join(root, 'game');
    const proj = join(project, 'build', 'jsb-link', 'frameworks', 'runtime-src', 'proj.android-studio');
    mkdirSync(project, { recursive: true });
    cpSync(template, proj, { recursive: true });
    const javaHome = '/Library/Java/JavaVirtualMachines/example-17.jdk/Contents/Home';
    applyCreator2Host(project, proj, config, javaHome);
    const first = readFileSync(join(proj, 'app', 'AndroidManifest.xml'), 'utf8');
    applyCreator2Host(project, proj, config, javaHome);
    const second = readFileSync(join(proj, 'app', 'AndroidManifest.xml'), 'utf8');
    assert.equal(first, second);
    assert.match(second, /GloryAdLaunchActivity/);
    assert.match(second, /app_key/);
    assert.match(second, /org\.cocos2dx\.javascript\.MyApplication/);
    assert.equal((second.match(/android\.intent\.category\.LAUNCHER/g) || []).length, 1);
    const gradle = readFileSync(join(proj, 'settings.gradle'), 'utf8');
    assert.match(gradle, /glory-adsdk/);
    assert.match(readFileSync(join(proj, 'gradle.properties'), 'utf8'), /GLORY_GAME_CENTER_APP_SECRET=fixture-secret/);
    assert.match(readFileSync(join(proj, 'gradle.properties'), 'utf8'), /org\.gradle\.java\.home=\/Library\/Java\/JavaVirtualMachines\/example-17\.jdk\/Contents\/Home/);
    assert.match(readFileSync(join(proj, 'app', 'src', 'org', 'cocos2dx', 'javascript', 'MyApplication.java'), 'utf8'), /37145911/);
    assert.match(second, /tools:replace="android:exported"/);
    assert.doesNotMatch(second, /android:allowBackup="true"/);
    const appGradle = readFileSync(join(proj, 'app/build.gradle'), 'utf8');
    assert.doesNotMatch(appGradle, /^\s*delete /m);
    assert.match(appGradle, /variant.mergeAssets.inputs.files/);
    assert.match(appGradle, /\$\{buildDir\}\/\.\.\/\.\.\/\.\.\/\.\.\/\.\./);
    assert.match(appGradle, /assets.srcDirs/);
    assert.match(appGradle, /db-framework:1.1.1/);
    const activity = readFileSync(join(proj, 'app/src/org/cocos2dx/javascript/AppActivity.java'), 'utf8');
    assert.equal((activity.match(/AdSdk.onMainActivityReady\(this\)/g) || []).length, 1);
    assert.equal((activity.match(/boolean onKeyDown/g) || []).length, 1);
    const persistent = join(project, 'build-templates/jsb-link/frameworks/runtime-src/proj.android-studio');
    assert.equal(readFileSync(join(persistent, 'app/build.gradle'), 'utf8'), appGradle);
    assert.doesNotMatch(readFileSync(join(persistent, 'gradle.properties'), 'utf8'), /org.gradle.java.home=/);
    const r8 = readFileSync(join(proj, 'app/proguard-rules.pro'), 'utf8');
    assert.match(r8, /-keep class androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory/);
    assert.doesNotMatch(r8, /-ignorewarnings/);
    const privacy = { policyUrl: 'https://example.invalid/privacy', skipBeforeTime: '2026-11-08 00:00:00' };
    applyCreator2Host(project, proj, { ...config, privacy }, javaHome);
    applyCreator2Host(project, proj, config, javaHome);
    const application = readFileSync(join(proj, 'app/src/org/cocos2dx/javascript/MyApplication.java'), 'utf8');
    assert.ok(application.includes(`privacyConfig.privacyPolicyUrl = "${privacy.policyUrl}";`));
    assert.ok(application.includes(`config.skipPrivacyBeforeTime = "${privacy.skipBeforeTime}";`));
});

test('NDK 路径含空格时包装器正确转发参数，重复准备不新增备份', () => {
    const root = mkdtempSync(join(tmpdir(), 'glory-env-'));
    const project = join(root, 'a game $dollar');
    const proj = join(project, 'build/jsb-link/frameworks/runtime-src/proj.android-studio');
    const sdk = join(root, 'sdk');
    const ndk = join(sdk, 'ndk/21.4.7075529');
    mkdirSync(proj, { recursive: true }); mkdirSync(ndk, { recursive: true });
    writeFileSync(join(ndk, 'ndk-build'), '#!/bin/bash\nprintf "%s\\n" "$@"\n');
    writeFileSync(join(ndk, 'source.properties'), 'Pkg.Revision=21.4.7075529\n');
    writeFileSync(join(proj, 'local.properties'), 'custom=value\n');
    const settings = { android: { ndkVersion: '21.4.7075529' } };
    const options = { cacheRoot: join(root, 'cache'), platform: 'darwin', arch: 'x64', runner: () => ({ status: 0, stdout: '0' }) };
    const result = prepareCreator2Environment(project, proj, settings, '/example/jdk17', sdk, options);
    const run = spawnSync('python3', [join(result.ndkPath, 'ndk-build'), 'APP_BUILD_SCRIPT=' + project + '/jni/Android.mk'], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stdout, /a game/);
    assert.match(run.stdout, /game-[a-f0-9]+\/jni\/Android.mk/);
    assert.match(readFileSync(join(proj, 'local.properties'), 'utf8'), /custom=value/);
    assert.match(readFileSync(join(proj, '.idea/gradle.xml'), 'utf8'), /#GRADLE_LOCAL_JAVA_HOME/);
    assert.match(readFileSync(join(proj, 'gradle.properties'), 'utf8'), /-Xmx4096m/);
    const backups = readdirSync(join(project, 'build/glory-cli/backups'));
    prepareCreator2Environment(project, proj, settings, '/example/jdk17', sdk, options);
    assert.deepEqual(readdirSync(join(project, 'build/glory-cli/backups')), backups);
    assert.equal(existsSync(join(ndk, 'source.properties')), true);
});

test('静态检查定位 Home/home 和裸 Base64，不修改源码', () => {
    const project = mkdtempSync(join(tmpdir(), 'glory-startup-'));
    mkdirSync(join(project, 'assets'), { recursive: true });
    writeFileSync(join(project, 'assets/home.meta'), JSON.stringify({ isBundle: true, bundleName: '' }));
    const path = join(project, 'assets/loading.ts');
    const source = `import { Base64 } from "js-base64";\nconst info = {bundleKey:'Home',bundle:'Home'};\n// loadBundle('Home')\n`;
    writeFileSync(path, source);
    const checks = inspectStartupSources(project);
    assert.equal(checks.filter((check) => check.id === 'startup.bundle-case').length, 1);
    assert.equal(checks.find((check) => check.id === 'startup.bundle-case').line, 2);
    assert.equal(checks.find((check) => check.id === 'startup.bare-base64').status, 'warn');
    assert.equal(readFileSync(path, 'utf8'), source);
    writeFileSync(path, source.replace('"js-base64"', '"./vendor/js-base64"').replace("bundle:'Home'", "bundle:'home'"));
    assert.deepEqual(inspectStartupSources(project), []);
});

test('启动证据区分场景命中、异常和待人工确认', async () => {
    assert.equal(classifyStartupLog('LoadScene Home: 1ms', 'Home').status, 'pass');
    assert.equal(classifyStartupLog('LoadScene Home: 1ms', 'Main').status, 'review');
    assert.equal(classifyStartupLog('Cocos Creator v2.4.15').status, 'review');
    assert.equal(classifyStartupLog("Cannot find module 'js-base64'\nLoadScene Home: 1ms", 'Home').status, 'fail');
    const project = mkdtempSync(join(tmpdir(), 'glory-device-'));
    const calls = [];
    const runner = (_, args) => {
        calls.push(args);
        if (args[0] === 'devices') return { status: 0, stdout: 'List of devices attached\nfixture\tdevice\n' };
        if (args.includes('pidof')) return { status: 0, stdout: '123\n' };
        if (args.includes('logcat')) return { status: 0, stdout: 'LoadScene Home: 2ms\n' };
        if (args.includes('screencap')) return { status: 0, stdout: Buffer.from('fixture-png') };
        if (args.includes('dumpsys')) return { status: 0, stdout: `mResumedActivity: ${config.game.packageName}/.AppActivity` };
        throw new Error('意外设备操作：' + args.join(' '));
    };
    const report = await deviceSmoke(project, config, '/fixture/sdk', { runner, 'capture-only': true, 'expect-scene': 'Home' });
    assert.equal(report.status, 'pass');
    assert.equal(existsSync(join(report.directory, 'screen.png')), true);
    assert.ok(calls.every((args) => !args.includes('install') && !args.includes('clear') && !args.includes('uninstall') && !args.includes('start')));
    await assert.rejects(() => deviceSmoke(project, config, '/fixture/sdk', { runner, 'capture-only': true, apk: 'bad.apk' }), /不可与/);
});
