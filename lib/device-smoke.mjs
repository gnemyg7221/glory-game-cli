import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classifyStartupLog } from './startup-checks.mjs';

export async function deviceSmoke(project, config, sdk, options = {}) {
    const seconds = Number(options.seconds ?? 35);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 120) throw new Error('--seconds 必须为 1–120 秒。');
    const pkg = config.game.packageName;
    if (!/^[\w.]+$/.test(pkg)) throw new Error('包名无效。');
    const adb = sdk ? join(sdk, 'platform-tools/adb') : 'adb';
    const runner = options.runner || spawnSync;
    const command = (args, extra = {}) => {
        const result = runner(adb, args, { encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024, ...extra });
        if (result.error || result.status !== 0) throw new Error(`adb ${args[0]} 失败：${result.error?.message || result.stderr || result.stdout || ''}`);
        return result.stdout;
    };
    const devices = command(['devices']).split(/\r?\n/).map((line) => line.match(/^(\S+)\s+device$/)?.[1]).filter(Boolean);
    const serial = options.serial || (devices.length === 1 ? devices[0] : '');
    if (!serial || !devices.includes(serial)) throw new Error('请连接并授权一台设备，或用 --serial 指定已授权设备。');
    if (options['capture-only'] && options.apk) throw new Error('--capture-only 不可与 --apk 同时使用。');
    const run = (args, extra) => command(['-s', serial, ...args], extra);
    if (options.apk) {
        const apk = resolve(project, String(options.apk));
        if (!existsSync(apk)) throw new Error('找不到 APK：' + apk);
        const output = run(['install', '--no-incremental', '-r', apk], { timeout: 180000 });
        if (!/\bSuccess\b/.test(output)) throw new Error('覆盖安装未成功；未卸载、未清除数据：' + output);
    }
    if (!options['capture-only']) {
        const output = run(['shell', 'am', 'start', '-S', '-W', '-n', `${pkg}/com.glory.adsdk.launch.GloryAdLaunchActivity`]);
        if (/Error:|Exception|Status:\s*(?!ok\b)\w+/i.test(output)) throw new Error('启动失败：' + output);
    }
    const dir = join(project, 'build/glory-cli/device-smoke', new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.hrtime.bigint());
    mkdirSync(dir, { recursive: true });
    const deadline = Date.now() + (options['capture-only'] ? 0 : seconds * 1000);
    let log = '';
    let pid = '';
    let report;
    do {
        // pidof may return nonzero while the launcher is starting or after a crash.
        const result = runner(adb, ['-s', serial, 'shell', 'pidof', pkg], { encoding: 'utf8', timeout: 10000 });
        pid = String(result.stdout || '').trim().split(/\s+/)[0];
        if (/^\d+$/.test(pid)) {
            log = run(['logcat', '-d', '--pid=' + pid, '-v', 'threadtime']);
            report = classifyStartupLog(log, options['expect-scene']);
        } else {
            report = { status: options['capture-only'] ? 'review' : 'fail', reachedScene: false,
                failures: options['capture-only'] ? [] : ['未找到游戏进程，请检查启动或崩溃。'] };
        }
        if (report.status === 'fail' || Date.now() >= deadline) break;
        await new Promise((done) => setTimeout(done, 1000));
    } while (true);
    // No logcat clear, uninstall, signature replacement, or save-data operations.
    writeFileSync(join(dir, 'logcat.log'), log);
    const screen = run(['exec-out', 'screencap', '-p'], { encoding: null });
    writeFileSync(join(dir, 'screen.png'), screen);
    const activities = run(['shell', 'dumpsys', 'activity', 'activities']);
    const foreground = activities.split(/\r?\n/).some((line) => /mResumedActivity|topResumedActivity/.test(line) && line.includes(pkg + '/'));
    if (!foreground && report.status === 'pass') report.status = 'review';
    const summary = { ...report, serial, packageName: pkg, pid, expectedScene: options['expect-scene'] || null,
        foreground,
        captureOnly: Boolean(options['capture-only']), directory: dir,
        note: '场景日志检查不等于画面与交互验收；请查看截图。未指定期望场景或未出现标记时为 review。' };
    writeFileSync(join(dir, 'report.json'), JSON.stringify(summary, null, 2) + '\n');
    return summary;
}
