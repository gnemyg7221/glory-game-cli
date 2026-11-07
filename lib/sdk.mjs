import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

function git(repo, args, options = {}) {
    const result = spawnSync('git', args, {
        cwd: repo, encoding: 'utf8', timeout: options.timeoutMs || 30000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: options.progress ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', GIT_LFS_FORCE_PROGRESS: '1' },
    });
    if (result.error || result.status !== 0) {
        if (options.optional) return '';
        const timedOut = result.error?.code === 'ETIMEDOUT';
        throw new Error((options.label || 'SDK Git 操作') + (timedOut ? '超时' : '失败') +
            '。已保留接入目录，可重新运行 onboard 继续。' +
            (result.stderr ? '\n' + result.stderr.trim() : '') +
            (result.error && !timedOut ? '\n' + result.error.message : ''));
    }
    return (result.stdout || '').trim();
}

function isRepository(path) {
    if (!existsSync(path)) return false;
    const top = git(path, ['rev-parse', '--show-toplevel'], { optional: true });
    return Boolean(top) && realpathSync(top) === realpathSync(path);
}

function hasCommit(path, commit) {
    const result = spawnSync('git', ['cat-file', '-e', commit + '^{commit}'], { cwd: path, stdio: 'ignore', timeout: 10000 });
    return result.status === 0;
}

export function lfsPointers(repo, commit) {
    const tree = git(repo, ['ls-tree', '-r', '-l', commit]);
    const pointers = [];
    for (const line of tree.split('\n')) {
        const tab = line.indexOf('\t');
        if (tab < 0) continue;
        const [mode, type, oid, size] = line.slice(0, tab).trim().split(/\s+/);
        if (type !== 'blob' || Number(size) > 1024 || mode === '120000') continue;
        const content = git(repo, ['cat-file', 'blob', oid]);
        const match = content.match(/^version https:\/\/git-lfs.github.com\/spec\/v1\r?\noid sha256:([0-9a-f]{64})\r?\nsize (\d+)(?:\r?\n|$)/);
        if (match) pointers.push({ path: line.slice(tab + 1), oid: match[1], size: Number(match[2]) });
    }
    return pointers;
}

function matchesObject(path, pointer) {
    return existsSync(path) && statSync(path).isFile() && statSync(path).size === pointer.size
        && createHash('sha256').update(readFileSync(path)).digest('hex') === pointer.oid;
}

function lfsObjectsPath(repo) {
    // lfs env also honors a user's lfs.storage setting.
    const env = git(repo, ['lfs', 'env'], { optional: true });
    const configured = env.match(/^LocalMediaDir=(.+)$/m)?.[1];
    return configured || resolve(repo, git(repo, ['rev-parse', '--git-path', 'lfs/objects']));
}

function objectPath(root, pointer) {
    return join(root, pointer.oid.slice(0, 2), pointer.oid.slice(2, 4), pointer.oid);
}

export function seedLfsObjects(repo, pointers, sources) {
    const destination = lfsObjectsPath(repo);
    let copied = 0;
    for (const source of sources) {
        const sourceObjects = lfsObjectsPath(source);
        for (const pointer of pointers) {
            const target = objectPath(destination, pointer);
            if (matchesObject(target, pointer)) continue;
            const candidate = [objectPath(sourceObjects, pointer), join(source, pointer.path)]
                .find((path) => matchesObject(path, pointer));
            if (!candidate) continue;
            mkdirSync(dirname(target), { recursive: true });
            copyFileSync(candidate, target);
            copied++;
        }
    }
    return copied;
}

export function verifySdkFiles(repo, commit) {
    const missing = lfsPointers(repo, commit).filter((pointer) => !matchesObject(join(repo, pointer.path), pointer));
    if (missing.length) {
        throw new Error('SDK LFS 文件尚未就绪（不能用指针文件编译）：' + missing.map((item) => item.path).join('、'));
    }
}

const REGISTRY = join(homedir(), '.config', 'glory-game', 'sdk-sources.json');

function registeredSources() {
    try {
        const paths = JSON.parse(readFileSync(REGISTRY, 'utf8')).paths;
        return Array.isArray(paths) ? paths.filter((path) => typeof path === 'string') : [];
    } catch { return []; }
}

function rememberSource(path) {
    const paths = [...new Set([path, ...registeredSources()])].slice(0, 100);
    mkdirSync(dirname(REGISTRY), { recursive: true });
    writeFileSync(REGISTRY, JSON.stringify({ paths }, null, 2) + '\n');
}

export function findLocalSdkSources(project, config, options = {}) {
    const target = resolve(project, config.sdk.submodulePath);
    const candidates = [];
    const explicit = options['sdk-source'] || config.sdk.localPath;
    if (explicit) candidates.push(resolve(project, String(explicit)));
    candidates.push(...(options.sources || registeredSources()));
    const repoRoot = git(project, ['rev-parse', '--show-toplevel'], { optional: true }) || project;
    for (const root of new Set([dirname(project), dirname(repoRoot)])) {
        if (!existsSync(root)) continue;
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const sibling = join(root, entry.name);
            candidates.push(join(sibling, config.sdk.submodulePath));
            // Some repositories keep the Cocos project one directory below the root.
            if (!existsSync(join(sibling, 'package.json'))) {
                for (const child of readdirSync(sibling, { withFileTypes: true })) {
                    if (child.isDirectory() && !child.name.startsWith('.') && existsSync(join(sibling, child.name, 'package.json'))) {
                        candidates.push(join(sibling, child.name, config.sdk.submodulePath));
                    }
                }
            }
        }
    }
    const valid = [...new Set(candidates.map((path) => resolve(path)))].filter((path) =>
        path !== target && isRepository(path)
        && git(path, ['config', '--get', 'remote.origin.url'], { optional: true }) === config.sdk.submoduleUrl
        && hasCommit(path, config.sdk.commit));
    if (explicit && !valid.includes(resolve(project, String(explicit)))) {
        throw new Error('--sdk-source 必须是同一 SDK 仓库，且包含配置中钉死的 commit：' + explicit);
    }
    return valid;
}

function checkoutPinnedSdk(repo, commit, populate = false) {
    if (git(repo, ['rev-parse', 'HEAD'], { optional: true }) === commit) {
        if (populate) git(repo, ['checkout', commit, '--', '.']);
        return;
    }
    const name = 'glory-pinned-' + commit.slice(0, 12);
    const existing = git(repo, ['rev-parse', '--verify', 'refs/heads/' + name], { optional: true });
    if (existing && existing !== commit) {
        git(repo, ['checkout', '--detach', commit]);
    } else if (existing) {
        git(repo, ['checkout', name]);
    } else {
        git(repo, ['checkout', '-b', name, commit]);
    }
}

function hydrateSdk(repo, config, sources, timeoutMs) {
    const pointers = lfsPointers(repo, config.sdk.commit);
    if (!pointers.length) return;
    git(repo, ['lfs', 'version'], { label: '检查 Git LFS（请先安装 git-lfs）' });
    const copied = seedLfsObjects(repo, pointers, sources);
    if (copied) console.log('已从本机补齐 SDK LFS 缓存：' + copied + ' 个文件');
    const objects = lfsObjectsPath(repo);
    const missing = pointers.filter((pointer) => !matchesObject(objectPath(objects, pointer), pointer));
    if (missing.length) {
        console.log('下载 SDK LFS 二进制：' + missing.length + ' 个文件，最多等待 ' + Math.round(timeoutMs / 1000) + ' 秒');
        git(repo, ['-c', 'lfs.activitytimeout=60', 'lfs', 'fetch', 'origin', config.sdk.commit],
            { progress: true, timeoutMs, label: '下载 SDK LFS' });
    }
    git(repo, ['lfs', 'checkout'], { progress: true, timeoutMs, label: '恢复 SDK LFS 文件' });
    verifySdkFiles(repo, config.sdk.commit);
}

export function ensureSdkSubmodule(project, config, options = {}) {
    project = realpathSync(project);
    const repositoryRoot = git(project, ['rev-parse', '--show-toplevel']);
    const target = resolve(project, config.sdk.submodulePath);
    if (target === resolve(project) || !target.startsWith(resolve(project) + sep)) {
        throw new Error('sdk.submodulePath 必须位于 Cocos 工程内部');
    }
    const commit = String(config.sdk.commit || '');
    if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('sdk.commit 必须是完整的 40 位 Git commit');
    const timeoutSeconds = Number(options['sdk-timeout-seconds'] || config.sdk.timeoutSeconds || 300);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new Error('SDK 超时秒数必须大于 0');
    const timeoutMs = timeoutSeconds * 1000;
    const sources = findLocalSdkSources(project, config, options);
    if (isRepository(target)) {
        if (git(target, ['config', '--get', 'remote.origin.url']) !== config.sdk.submoduleUrl) throw new Error('SDK remote 与配置不一致：' + target);
        const status = git(target, ['status', '--porcelain']);
        if (status) throw new Error('SDK 子模块存在未提交修改，停止切换版本：\n' + status);
        if (!hasCommit(target, commit)) {
            console.log('获取指定 SDK commit（最多 ' + timeoutSeconds + ' 秒）');
            git(target, ['fetch', '--progress', 'origin', commit], { progress: true, timeoutMs, label: '获取 SDK commit' });
        } else {
            console.log('复用当前 SDK，跳过远程下载：' + commit);
        }
        checkoutPinnedSdk(target, commit);
        hydrateSdk(target, config, sources, timeoutMs);
    } else {
        if (existsSync(target) && readdirSync(target).length) {
            throw new Error('SDK 目录不是完整 Git 仓库，已保留原文件：' + target);
        }
        const key = createHash('sha256').update(config.sdk.submoduleUrl + commit).digest('hex').slice(0, 16);
        const staging = join(project, 'build', 'glory-cli', 'sdk-download', key);
        if (!existsSync(staging)) {
            mkdirSync(dirname(staging), { recursive: true });
            if (sources.length) {
                console.log('复用本机 SDK：' + sources[0]);
                git(project, ['clone', '--no-hardlinks', '--no-checkout', sources[0], staging],
                    { progress: true, timeoutMs, label: '复制本机 SDK' });
                git(staging, ['remote', 'set-url', 'origin', config.sdk.submoduleUrl]);
            } else {
                mkdirSync(staging, { recursive: true });
                git(staging, ['init', '-q']);
                git(staging, ['remote', 'add', 'origin', config.sdk.submoduleUrl]);
            }
        }
        if (!isRepository(staging) || git(staging, ['config', '--get', 'remote.origin.url']) !== config.sdk.submoduleUrl) {
            throw new Error('SDK 下载暂存目录不符合配置，已保留：' + staging);
        }
        if (!hasCommit(staging, commit)) {
            console.log('下载 SDK commit（实时进度，最多 ' + timeoutSeconds + ' 秒）：' + commit);
            git(staging, ['fetch', '--depth=1', '--progress', 'origin', commit],
                { progress: true, timeoutMs, label: '下载 SDK' });
        }
        checkoutPinnedSdk(staging, commit, true);
        hydrateSdk(staging, config, sources, timeoutMs);
        if (existsSync(target)) {
            const backup = join(project, 'build', 'glory-cli', 'backups', 'empty-sdk-' + Date.now());
            mkdirSync(dirname(backup), { recursive: true });
            renameSync(target, backup);
        }
        mkdirSync(dirname(target), { recursive: true });
        renameSync(staging, target);
    }
    const rel = relative(repositoryRoot, target);
    if (isAbsolute(rel) || rel.startsWith('..' + sep)) throw new Error('SDK 不在游戏仓库中');
    const modules = join(repositoryRoot, '.gitmodules');
    const recorded = existsSync(modules)
        ? git(repositoryRoot, ['config', '-f', modules, '--get', 'submodule.' + rel + '.path'], { optional: true })
        : '';
    if (!recorded) {
        git(repositoryRoot, ['submodule', 'add', config.sdk.submoduleUrl, rel], { progress: true, timeoutMs, label: '登记 SDK 子模块' });
    }
    git(repositoryRoot, ['submodule', 'absorbgitdirs', rel]);
    if (git(target, ['rev-parse', 'HEAD']) !== commit) throw new Error('SDK commit 与配置不一致');
    verifySdkFiles(target, commit);
    rememberSource(target);
    console.log('SDK 已就绪：' + commit + '（源码和 LFS 文件已检查）');
}

export { git as runSdkGit };
