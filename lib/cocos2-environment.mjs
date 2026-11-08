import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

function properties(content, values) {
    let result = content;
    for (const [key, value] of Object.entries(values)) {
        const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
        result = pattern.test(result) ? result.replace(pattern, () => `${key}=${value}`) : `${result.trimEnd()}\n${key}=${value}\n`;
    }
    return result;
}

// No cleanup: existing files are backed up; conflicting symlinks stop preparation.
export function prepareCreator2Environment(project, proj, config, javaHome, sdk, options = {}) {
    if (!javaHome || !sdk) throw new Error('Creator 2.4 环境准备需要有效 JDK 和 Android SDK。');
    const root = realpathSync(project);
    proj = realpathSync(proj);
    const ndk = join(sdk, 'ndk', String(config.android.ndkVersion));
    if (!existsSync(join(ndk, 'ndk-build'))) throw new Error('缺少 NDK：' + ndk);
    const state = join(root, 'build/glory-cli');
    const backup = join(state, 'backups', 'cli-environment-' + Date.now() + '-' + process.hrtime.bigint());
    const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
    const write = (path, content) => {
        if (read(path) === content) return;
        if (existsSync(path)) {
            const dest = join(backup, relative(root, path));
            mkdirSync(dirname(dest), { recursive: true });
            copyFileSync(path, dest);
        }
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
    };
    const platform = options.platform || process.platform;
    const arch = options.arch || process.arch;
    const runner = options.runner || spawnSync;
    const armMac = platform === 'darwin' && (arch === 'arm64' || runner('/usr/sbin/sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8' }).stdout?.trim() === '1');
    const oldNdk = Number(String(config.android.ndkVersion).split('.')[0]) <= 21;
    let ndkPath = ndk;
    if (platform === 'darwin' && oldNdk && (armMac || /\s/.test(root))) {
        if (armMac) {
            const result = runner('/usr/bin/arch', ['-x86_64', '/usr/bin/true'], { encoding: 'utf8' });
            if (result.error || result.status !== 0) throw new Error('NDK 21 需要 Rosetta，请先安装 Rosetta 后重试。');
        }
        const cache = options.cacheRoot || join(homedir(), 'Library/Caches/glory-game/native-paths');
        if (/\s/.test(cache)) throw new Error('NDK 路径别名目录不能包含空格：' + cache);
        const alias = join(cache, 'game-' + createHash('sha256').update(root).digest('hex').slice(0, 16));
        mkdirSync(cache, { recursive: true });
        const link = (target, path) => {
            let present = false;
            try { lstatSync(path); present = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
            if (present) {
                if (!lstatSync(path).isSymbolicLink() || !existsSync(path) || realpathSync(path) !== realpathSync(target)) {
                    throw new Error('兼容路径已被其他内容占用，未覆盖：' + path);
                }
            } else symlinkSync(target, path);
        };
        link(root, alias);
        ndkPath = join(state, 'ndk-compat');
        mkdirSync(ndkPath, { recursive: true });
        for (const name of readdirSync(ndk)) if (name !== 'ndk-build') link(join(ndk, name), join(ndkPath, name));
        const command = armMac ? ['/usr/bin/arch', '-x86_64', '/bin/bash', join(ndk, 'ndk-build')] : ['/bin/bash', join(ndk, 'ndk-build')];
        const wrapper = join(ndkPath, 'ndk-build');
        write(wrapper, `#!/usr/bin/python3
import os, sys
sources = ${JSON.stringify([...new Set([root, resolve(project)])].sort((a, b) => b.length - a.length))}
alias = ${JSON.stringify(alias)}
args = sys.argv[1:]
for source in sources:
    args = [arg.replace(source, alias) for arg in args]
command = ${JSON.stringify(command)}
os.execv(command[0], command + args)
`);
        chmodSync(wrapper, 0o755);
    }
    const local = join(proj, 'local.properties');
    write(local, properties(read(local), { 'sdk.dir': sdk, 'ndk.dir': ndkPath }));
    const gradle = join(proj, 'gradle.properties');
    write(gradle, properties(read(gradle), {
        'org.gradle.java.home': javaHome,
        'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8',
        'org.gradle.workers.max': '4',
    }));
    const configPath = join(proj, '.gradle/config.properties');
    write(configPath, properties(read(configPath), { 'java.home': javaHome }));
    const idea = join(proj, '.idea/gradle.xml');
    let xml = read(idea);
    if (!xml) xml = '<?xml version="1.0" encoding="UTF-8"?>\n<project version="4"><component name="GradleSettings"><option name="linkedExternalProjectsSettings"><GradleProjectSettings><option name="externalProjectPath" value="$PROJECT_DIR$" /></GradleProjectSettings></option></component></project>\n';
    if (/name="gradleJvm"/.test(xml)) xml = xml.replace(/(<option name="gradleJvm" value=")[^"]*("\s*\/>)/g, '$1#GRADLE_LOCAL_JAVA_HOME$2');
    else if (xml.includes('</GradleProjectSettings>')) xml = xml.replace('</GradleProjectSettings>', '<option name="gradleJvm" value="#GRADLE_LOCAL_JAVA_HOME" /></GradleProjectSettings>');
    else throw new Error('无法识别 .idea/gradle.xml，未覆盖：' + idea);
    write(idea, xml);
    return { ndkPath, javaHome, backup };
}
