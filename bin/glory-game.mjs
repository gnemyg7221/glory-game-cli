#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import YAML from 'yaml';

const CLI_VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;
const DEFAULT_CONFIG = 'glory-game.yaml';
const CONFIG_CANDIDATES = ['glory-game.yaml', 'glory-game.yml', 'glory-game.config.json'];
const STATE_FILE = join(homedir(), '.config', 'glory-game', 'state.json');
const VERIFIED_COCOS_38_PROFILE = {
    name: 'glory-oppo-cocos-3.8-v1',
    cocos: {
        apiLevel: 29,
        appABIs: ['arm64-v8a', 'armeabi-v7a'],
        buildRoot: 'build',
        timeoutMinutes: 30,
    },
    android: {
        javaVersion: 11,
        agpVersion: '7.4.2',
        gradleVersion: '7.6.3',
        compileSdk: 29,
        targetSdk: 29,
        buildToolsVersion: '30.0.3',
        ndkVersion: '21.4.7075529',
        cmakeVersion: '3.22.1',
    },
    sdk: {
        submodulePath: 'native/engine/android/glory-adsdk',
        submoduleUrl: 'git@github.com:superWalnuts/OppoGameApkAdSdk.git',
        commit: 'ccaef3e1ef6821928c850bd1858acafa7ab975f5',
        gameCenterAppSecretEnv: 'GLORY_GAME_CENTER_APP_SECRET',
    },
};

class CliError extends Error {
    constructor(message, exitCode = 2) {
        super(message);
        this.exitCode = exitCode;
    }
}

function parseArgs(argv) {
    const [command = 'help', ...rest] = argv;
    const options = {};
    const positional = [];
    for (let index = 0; index < rest.length; index += 1) {
        const value = rest[index];
        if (!value.startsWith('--')) {
            positional.push(value);
            continue;
        }
        const equalIndex = value.indexOf('=');
        if (equalIndex !== -1) {
            options[value.slice(2, equalIndex)] = value.slice(equalIndex + 1);
            continue;
        }
        const key = value.slice(2);
        if (rest[index + 1] && !rest[index + 1].startsWith('--')) {
            options[key] = rest[index + 1];
            index += 1;
        } else {
            options[key] = true;
        }
    }
    return { command, options, positional };
}

function usage() {
    return `glory-game ${CLI_VERSION}

用法：
  glory-game inspect [--project <repo-or-cocos-path>] [--config <path>] [--json]
  glory-game use --project <repo-or-cocos-path>
  glory-game status [--project <repo-or-cocos-path>] [--config <path>]
  glory-game configure [game|sdk|privacy] [--project <repo-or-cocos-path>] [--config <path>]
  glory-game init-config [--project <repo-or-cocos-path>] [--output <path>] [--stdout|--non-interactive] [--format yaml|json]
  glory-game plan --config <path> [--project <path>] [--json]
  glory-game apply --config <path> [--project <path>] [--scaffold] [--dry-run] [--skip-submodule]
  glory-game cocos-build --config <path> [--project <path>] [--mode debug|release]
                          [--output-name <name>] [--dry-run]
  glory-game android-build --config <path> --input <cocos-output> [--mode debug|release]
                            [--dry-run]
  glory-game integrate --config <path> [--project <path>] [--mode debug|release] [--scaffold] [--dry-run]
  glory-game verify-apk --config <path> --apk <path> [--json]
  glory-game self-test --config <path> [--project <path>]

当前范围：
  macOS、Cocos Creator 3.8.x、Android，以及已识别项目结构的 glory-adsdk 接入。

快速接入：
  init-config 问包名；启动场景写入 glory-game.yaml。对方电脑不需要本机 Cocos profiles。
  integrate --scaffold 可在暂不填写 SDK 后台/隐私参数时完成 SDK、Cocos 和 Android Debug 编译。
  该模式生成的 APK 仅用于验证接入和编译，不能发布；以后填写真实参数后重新 integrate 即可。

安全约束：
  inspect、plan 和所有 --dry-run 不修改游戏源码；CLI 不执行删除。
`;
}

function readJson(path, label = path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
        throw new CliError(`无法读取 ${label}：${error.message}`);
    }
}

function readConfigDocument(path) {
    const content = readFileSync(path, 'utf8');
    try {
        if (/\.ya?ml$/i.test(path)) return YAML.parse(content);
        return JSON.parse(content);
    } catch (error) {
        throw new CliError(`无法读取接入配置 ${path}：${error.message}`);
    }
}

function serializeConfig(path, value) {
    return /\.json$/i.test(path)
        ? `${JSON.stringify(value, null, 2)}\n`
        : YAML.stringify(value, { indent: 2, lineWidth: 0 });
}

function readText(path) {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function firstExisting(paths) {
    return paths.find((path) => path && existsSync(path));
}

const JS_ADAPTER_LAYOUTS = [
    {
        name: 'assets/adsdk/platform/Native',
        files: ['assets/adsdk/platform/Native/NativeOpenAPI.ts', 'assets/adsdk/platform/Native/NativeHybridAdManager.ts'],
    },
    {
        name: 'assets/AdSdk/script/platform/Native',
        files: ['assets/AdSdk/script/platform/Native/NativeOpenAPI.ts', 'assets/AdSdk/script/platform/Native/NativeHybridAdManager.ts'],
    },
];

function detectJsAdapterLayout(project) {
    return JS_ADAPTER_LAYOUTS.find((layout) => layout.files.every((file) => existsSync(join(project, file)))) || null;
}

function isCocosProject(path) {
    const packagePath = join(path, 'package.json');
    if (!existsSync(packagePath)) return false;
    try {
        return Boolean(JSON.parse(readFileSync(packagePath, 'utf8')).creator?.version);
    } catch {
        return false;
    }
}

function resolveProjectAt(inputPath) {
    const input = resolve(String(inputPath));
    if (isCocosProject(input)) return input;
    if (!existsSync(input) || !statSync(input).isDirectory()) {
        throw new CliError(`项目目录不存在：${input}`);
    }
    const projects = readdirSync(input, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => join(input, entry.name))
        .filter(isCocosProject);
    if (projects.length === 1) return projects[0];
    if (projects.length > 1) {
        const integrationTargets = projects.filter((project) => detectJsAdapterLayout(project));
        if (integrationTargets.length === 1) return integrationTargets[0];
        throw new CliError(`仓库中发现多个 Cocos 项目，请通过 --project 指定其中一个：\n- ${projects.join('\n- ')}`);
    }
    throw new CliError(`未找到 Cocos 项目（需要含 creator.version 的 package.json）：${input}`);
}

function rememberedProject() {
    if (!existsSync(STATE_FILE)) return null;
    try {
        const path = readJson(STATE_FILE, 'CLI 状态').project;
        return path ? resolveProjectAt(path) : null;
    } catch {
        return null;
    }
}

function rememberProject(project) {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, `${JSON.stringify({ project }, null, 2)}\n`, 'utf8');
}

function resolveProject(options) {
    if (options.project) return resolveProjectAt(options.project);
    try {
        return resolveProjectAt(process.cwd());
    } catch (cwdError) {
        const remembered = rememberedProject();
        if (remembered) return remembered;
        throw new CliError(`${cwdError.message}\n请通过 --project 指定一次，或运行 glory-game use --project <项目路径>`);
    }
}

function resolveConfigPath(project, options, required) {
    const explicit = options.config
        ? (isAbsolute(String(options.config)) ? resolve(String(options.config)) : resolve(project, String(options.config)))
        : null;
    const candidate = explicit || CONFIG_CANDIDATES.map((name) => join(project, name)).find(existsSync) || join(project, DEFAULT_CONFIG);
    if (!existsSync(candidate)) {
        if (required) {
            throw new CliError(`缺少接入配置：${candidate}\n请先运行 glory-game init-config --project ${project}`);
        }
        return null;
    }
    return candidate;
}

function validateConfig(config) {
    const errors = [];
    if (config.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
    if (!config.game?.name) errors.push('缺少 game.name');
    if (!config.game?.packageName) errors.push('缺少 game.packageName');
    if (!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(config.game?.packageName || '')) {
        errors.push('game.packageName 不是有效的 Android 包名');
    }
    if (!config.cocos?.version) errors.push('缺少 cocos.version');
    if (!Number.isInteger(config.cocos?.apiLevel)) errors.push('cocos.apiLevel 必须为整数');
    if (!Array.isArray(config.cocos?.appABIs) || config.cocos.appABIs.length === 0) {
        errors.push('cocos.appABIs 必须是非空数组');
    }
    if (config.game?.versionCode !== undefined && (!Number.isInteger(config.game.versionCode) || config.game.versionCode < 1)) {
        errors.push('game.versionCode 必须是正整数');
    }
    if (config.game?.orientation && !['portrait', 'landscape'].includes(config.game.orientation)) {
        errors.push('game.orientation 只能是 portrait 或 landscape');
    }
    if (!isMissingConfigValue(config.cocos?.startScene) && typeof config.cocos.startScene !== 'string') {
        errors.push('cocos.startScene 必须是场景路径字符串，例如 assets/scene/Main.scene');
    }
    if (errors.length) throw new CliError(`配置无效：\n- ${errors.join('\n- ')}`);
}

function validateApplyConfig(config) {
    validateConfig(config);
    const errors = [];
    const required = [
        ['game.versionCode', config.game?.versionCode],
        ['game.versionName', config.game?.versionName],
        ['android.agpVersion', config.android?.agpVersion],
        ['android.gradleVersion', config.android?.gradleVersion],
        ['android.compileSdk', config.android?.compileSdk],
        ['android.targetSdk', config.android?.targetSdk],
        ['android.buildToolsVersion', config.android?.buildToolsVersion],
        ['android.ndkVersion', config.android?.ndkVersion],
        ['android.cmakeVersion', config.android?.cmakeVersion],
        ['sdk.submodulePath', config.sdk?.submodulePath],
        ['sdk.submoduleUrl', config.sdk?.submoduleUrl],
        ['sdk.commit', config.sdk?.commit],
        ['sdk.gameCenterAppSecretEnv', config.sdk?.gameCenterAppSecretEnv],
    ];
    for (const [name, value] of required) {
        if (value === undefined || value === null || value === '' || value === 'REQUIRED') errors.push(`缺少真实参数 ${name}`);
    }
    if (typeof config.game?.offlineGame !== 'boolean') errors.push('game.offlineGame 必须是布尔值');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.sdk?.gameCenterAppSecretEnv || '')) {
        errors.push('sdk.gameCenterAppSecretEnv 不是有效的环境变量名');
    }
    if (errors.length) {
        throw new CliError(`接入配置不完整：\n- ${errors.join('\n- ')}\n请补全配置后重试；可运行 init-config --stdout 查看完整字段。`);
    }
}

function detectedOrientation(project) {
    const settingsPath = join(project, 'settings', 'v2', 'packages', 'project.json');
    if (!existsSync(settingsPath)) return null;
    const resolution = readJson(settingsPath, 'Cocos 项目设置').general?.designResolution;
    const width = Number(resolution?.width);
    const height = Number(resolution?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return height >= width ? 'portrait' : 'landscape';
}

function readOptionalJson(path) {
    if (!existsSync(path)) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

function isSceneUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function listProjectScenes(project) {
    const files = findFiles(join(project, 'assets'), (path) => path.endsWith('.scene'))
        .sort((a, b) => a.localeCompare(b));
    return files.map((abs) => {
        const relativePath = relative(project, abs).split(sep).join('/');
        const meta = readOptionalJson(`${abs}.meta`);
        return {
            abs,
            path: relativePath,
            uuid: meta?.uuid || null,
            name: basename(abs, '.scene'),
        };
    });
}

function matchScene(scenes, value) {
    const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^db:\/\//, '');
    if (!normalized) return null;
    return isSceneUuid(normalized)
        ? scenes.find((scene) => scene.uuid === normalized)
        : scenes.find((scene) => scene.path === normalized || scene.path === `assets/${normalized}` || scene.name === normalized);
}

function sceneCustomScriptCount(absPath) {
    const types = [...readText(absPath).matchAll(/"__type__"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
    return types.filter((type) => !type.startsWith('cc.') && !type.startsWith('CC')).length;
}

function collectCocosStartSceneHints(project) {
    const hints = [];
    const profileDir = join(project, 'profiles', 'v2', 'packages');
    if (!existsSync(profileDir)) return hints;
    const rank = {
        'android.json': 1,
        'builder.json': 2,
        'oppo-mini-game.json': 3,
        'wechatgame.json': 4,
        'vivo-mini-game.json': 5,
        'honor-mini-game.json': 6,
    };
    for (const name of readdirSync(profileDir)) {
        if (!rank[name]) continue;
        const json = readOptionalJson(join(profileDir, name));
        if (!json) continue;
        const pushHint = (value, reason) => {
            if (!value) return;
            hints.push({ value, reason, rank: rank[name], file: name });
        };
        pushHint(json.common?.startScene, `Cocos ${name} 构建配置`);
        pushHint(json.builder?.common?.startScene, `Cocos ${name} 构建配置`);
        const onlyScene = json.common?.scenes?.length === 1 ? json.common.scenes[0] : null;
        pushHint(onlyScene?.uuid || onlyScene?.url, `Cocos ${name} 只包含一个场景`);
        const tasks = Object.values(json.BuildTaskManager?.taskMap || {});
        const latest = tasks.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
        pushHint(latest?.options?.startScene, 'Cocos 上次构建任务');
    }
    return hints.sort((a, b) => a.rank - b.rank);
}

function detectStartScene(project) {
    const scenes = listProjectScenes(project);
    if (!scenes.length) return null;
    for (const hint of collectCocosStartSceneHints(project)) {
        const match = matchScene(scenes, hint.value);
        if (match?.uuid) return { path: match.path, uuid: match.uuid, reason: hint.reason };
    }
    if (scenes.length === 1 && scenes[0].uuid) {
        return { path: scenes[0].path, uuid: scenes[0].uuid, reason: '工程里只有一个场景' };
    }
    const scored = scenes.map((scene) => ({ ...scene, scripts: sceneCustomScriptCount(scene.abs) }));
    const withScripts = scored.filter((scene) => scene.scripts > 0);
    const empty = scored.filter((scene) => scene.scripts === 0);
    if (withScripts.length === 1 && withScripts[0].uuid && empty.length === scored.length - 1) {
        return { path: withScripts[0].path, uuid: withScripts[0].uuid, reason: '另一个场景是空场景' };
    }
    return null;
}

function resolveStartSceneUuid(project, startScene) {
    const scenes = listProjectScenes(project);
    if (!scenes.length) throw new CliError('工程 assets 下没有 .scene 文件。');
    const match = matchScene(scenes, startScene);
    if (!match) {
        throw new CliError(`cocos.startScene 无效：${startScene}\n可选场景：\n- ${scenes.map((scene) => scene.path).join('\n- ')}`);
    }
    if (!match.uuid) throw new CliError(`场景缺少 uuid，无法构建：${match.path}`);
    return match.uuid;
}

function resolveBuildStartScene(project, config) {
    if (!isMissingConfigValue(config.cocos?.startScene)) {
        return {
            path: String(config.cocos.startScene),
            uuid: resolveStartSceneUuid(project, config.cocos.startScene),
            reason: 'glory-game.yaml',
        };
    }
    const detected = detectStartScene(project);
    if (!detected) {
        const scenes = listProjectScenes(project).map((scene) => scene.path).join('\n- ');
        throw new CliError(`无法识别启动场景，请在 glory-game.yaml 填写 cocos.startScene。\n可选场景：\n- ${scenes}`);
    }
    return detected;
}

async function askStartScene(rl, project) {
    const scenes = listProjectScenes(project);
    if (!scenes.length) throw new CliError('工程 assets 下没有 .scene 文件。');
    console.log('未能自动识别启动场景，请按序号选择：');
    scenes.forEach((scene, index) => {
        console.log(`  ${index + 1}) ${scene.path}`);
    });
    const answer = await askValue(rl, '选择启动场景序号', {
        validate: (value) => {
            const index = Number(value);
            return Number.isInteger(index) && index >= 1 && index <= scenes.length
                ? null
                : `请输入 1-${scenes.length}`;
        },
    });
    return scenes[Number(answer) - 1].path;
}

function createScaffoldConfig(project, config) {
    const value = JSON.parse(JSON.stringify(config));
    value.game ||= {};
    value.sdk ||= {};
    value.privacy ||= {};
    value.game.orientation = isMissingConfigValue(value.game.orientation)
        ? detectedOrientation(project) || 'portrait'
        : value.game.orientation;
    if (isMissingConfigValue(value.game.offlineGame)) value.game.offlineGame = false;
    if (isMissingConfigValue(value.sdk.gameCenterAppKey)) value.sdk.gameCenterAppKey = '';
    if (isMissingConfigValue(value.sdk.providerAppId)) value.sdk.providerAppId = '';
    if (isMissingConfigValue(value.sdk.supplierAppId)) value.sdk.supplierAppId = '';
    if (isMissingConfigValue(value.privacy.policyUrl)) value.privacy.policyUrl = '';
    if (isMissingConfigValue(value.privacy.skipBeforeTime)) value.privacy.skipBeforeTime = '';
    return value;
}

function loadConfig(project, options, required = true) {
    const path = resolveConfigPath(project, options, required);
    if (!path) return { path: null, value: null };
    const value = readConfigDocument(path);
    validateConfig(value);
    return { path, value };
}

function loadConfigUnchecked(project, options, required = true) {
    const path = resolveConfigPath(project, options, required);
    return { path, value: path ? readConfigDocument(path) : null };
}

function isMissingConfigValue(value) {
    return value === undefined || value === null || value === '' || String(value).startsWith('REQUIRED');
}

function printConfigStatus(project, configPath, config) {
    const sections = [
        ['基础', [
            ['game.packageName', config.game?.packageName],
            ['game.orientation', config.game?.orientation],
            ['game.offlineGame', config.game?.offlineGame],
            ['cocos.startScene', config.cocos?.startScene],
        ]],
        ['SDK 后台', [
            ['sdk.gameCenterAppKey', config.sdk?.gameCenterAppKey],
            ['sdk.providerAppId', config.sdk?.providerAppId],
            ['sdk.supplierAppId', config.sdk?.supplierAppId],
        ]],
        ['隐私', [
            ['privacy.policyUrl', config.privacy?.policyUrl],
            ['privacy.skipBeforeTime', config.privacy?.skipBeforeTime],
        ]],
    ];
    console.log(`项目：${project}`);
    console.log(`配置：${configPath}`);
    console.log(`共用配置：${config.profile || '(未声明)'}\n`);
    let missingCount = 0;
    for (const [section, fields] of sections) {
        const missing = fields.filter(([, value]) => isMissingConfigValue(value)).map(([name]) => name);
        missingCount += missing.length;
        if (!missing.length) console.log(`✓ ${section}：已填写`);
        else console.log(`○ ${section}：以后补 ${missing.join('、')}`);
    }
    const secretEnv = config.sdk?.gameCenterAppSecretEnv || VERIFIED_COCOS_38_PROFILE.sdk.gameCenterAppSecretEnv;
    console.log(`${process.env[secretEnv] ? '✓' : '○'} 运行密钥：${secretEnv}${process.env[secretEnv] ? ' 已设置' : ' 尚未设置（构建前再设置）'}`);
    console.log('○ Release 签名：Debug 阶段不需要');
    console.log(missingCount ? `\n当前还有 ${missingCount} 个游戏专属字段；可以分批填写，不影响先做 inspect。` : '\n游戏专属配置已齐，可以执行 integrate --dry-run。');
}

function creatorExecutable(version, config) {
    const configured = config?.cocos?.executable;
    const candidates = [
        configured && (isAbsolute(configured) ? configured : resolve(configured)),
        process.env.COCOS_CREATOR_BIN,
        `/Applications/Cocos/Creator/${version}/CocosCreator.app/Contents/MacOS/CocosCreator`,
        `/Applications/CocosCreator/Creator/${version}/CocosCreator.app/Contents/MacOS/CocosCreator`,
    ];
    return { path: firstExisting(candidates), candidates: candidates.filter(Boolean) };
}

function javaVersion(javaHome) {
    if (!javaHome || !existsSync(join(javaHome, 'bin', 'java'))) return null;
    const result = spawnSync(join(javaHome, 'bin', 'java'), ['-version'], { encoding: 'utf8' });
    const text = `${result.stdout || ''}\n${result.stderr || ''}`;
    const match = text.match(/version\s+"([^"]+)"/);
    return match?.[1] || null;
}

function systemJava(major) {
    if (process.platform !== 'darwin' || !existsSync('/usr/libexec/java_home')) return null;
    const result = spawnSync('/usr/libexec/java_home', ['-v', String(major)], { encoding: 'utf8' });
    const path = result.status === 0 ? result.stdout.trim() : '';
    return path && existsSync(path) ? path : null;
}

function resolveJava(config, defaultMajor = 11) {
    const configured = config?.android?.javaHome;
    const requiredMajor = Number(config?.android?.javaVersion || (config?.android?.agpVersion?.startsWith('8.') ? 17 : config?.android?.agpVersion ? 11 : defaultMajor));
    const path = firstExisting([
        configured && (isAbsolute(configured) ? configured : resolve(configured)),
        systemJava(requiredMajor),
        process.env.JAVA_HOME,
    ]);
    return { path, version: javaVersion(path), requiredMajor, shellPath: process.env.JAVA_HOME || null, shellVersion: javaVersion(process.env.JAVA_HOME) };
}

function creatorAndroidToolchain(creatorPath) {
    if (!creatorPath) return null;
    const contents = dirname(dirname(creatorPath));
    const buildGradle = join(contents, 'Resources', 'resources', '3d', 'engine', 'templates', 'android', 'build', 'build.gradle');
    const wrapper = join(contents, 'Resources', 'resources', '3d', 'engine', 'templates', 'android', 'build', 'gradle', 'wrapper', 'gradle-wrapper.properties');
    const agpVersion = readText(buildGradle).match(/com\.android\.tools\.build:gradle:([^'"\s]+)/)?.[1] || null;
    const gradleVersion = readText(wrapper).match(/gradle-([0-9][^-]*)-(?:bin|all)\.zip/)?.[1] || null;
    if (!agpVersion && !gradleVersion) return null;
    return {
        agpVersion,
        gradleVersion,
        javaVersion: agpVersion?.startsWith('8.') ? 17 : 11,
    };
}

function initialConfig(project) {
    const projectPackage = readJson(join(project, 'package.json'), 'Cocos package.json');
    const version = projectPackage.creator?.version;
    const detected = detectStartScene(project);
    return {
        schemaVersion: 1,
        profile: VERIFIED_COCOS_38_PROFILE.name,
        game: {
            name: projectPackage.name || basename(project),
            packageName: 'REQUIRED',
            versionCode: 1,
            versionName: '1.0.0',
            orientation: detectedOrientation(project) || 'portrait',
            offlineGame: false,
        },
        cocos: {
            version,
            ...VERIFIED_COCOS_38_PROFILE.cocos,
            startScene: detected?.path || 'REQUIRED',
        },
        android: {
            ...VERIFIED_COCOS_38_PROFILE.android,
        },
        sdk: {
            ...VERIFIED_COCOS_38_PROFILE.sdk,
        },
    };
}

async function askValue(rl, label, options = {}) {
    const defaultValue = options.defaultValue;
    const suffix = defaultValue !== undefined && defaultValue !== null && defaultValue !== '' ? ` [${defaultValue}]` : '';
    while (true) {
        const answer = (await rl.question(`${label}${suffix}: `)).trim();
        const value = answer || (defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '');
        if (!value && options.required !== false) {
            console.log('  该项不能为空。');
            continue;
        }
        const error = options.validate?.(value);
        if (error) {
            console.log(`  ${error}`);
            continue;
        }
        return value;
    }
}

async function askBoolean(rl, label, currentValue) {
    const value = await askValue(rl, `${label} (yes/no)`, {
        defaultValue: typeof currentValue === 'boolean' ? (currentValue ? 'yes' : 'no') : undefined,
        validate: (answer) => /^(yes|no|y|n)$/i.test(answer) ? null : '请输入 yes 或 no。',
    });
    return /^(yes|y)$/i.test(value);
}

function nextConfigSection(config) {
    if ([config.game?.packageName, config.game?.orientation, config.game?.offlineGame].some(isMissingConfigValue)) return 'game';
    if ([config.sdk?.gameCenterAppKey, config.sdk?.providerAppId, config.sdk?.supplierAppId].some(isMissingConfigValue)) return 'sdk';
    if ([config.privacy?.policyUrl, config.privacy?.skipBeforeTime].some(isMissingConfigValue)) return 'privacy';
    return null;
}

async function configureProject(project, options, requestedSection) {
    const loaded = loadConfigUnchecked(project, options, true);
    const config = loaded.value;
    const section = requestedSection || nextConfigSection(config);
    if (!section) {
        console.log('游戏专属配置已经填齐。下一步运行 glory-game integrate --mode debug --dry-run');
        return;
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new CliError('configure 需要在交互式终端中运行');
    if (!['game', 'sdk', 'privacy'].includes(section)) {
        throw new CliError('configure 分组只能是 game、sdk 或 privacy');
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(`本次只填写：${section}\n`);
    try {
        if (section === 'game') {
            config.game ||= {};
            if (isMissingConfigValue(config.game.packageName)) {
                config.game.packageName = await askValue(rl, 'Android packageName', {
                    validate: (answer) => /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(answer) ? null : '不是有效的 Android 包名。',
                });
            }
            config.game.orientation = await askValue(rl, '屏幕方向 portrait/landscape', {
                defaultValue: isMissingConfigValue(config.game.orientation) ? undefined : config.game.orientation,
                validate: (answer) => ['portrait', 'landscape'].includes(answer) ? null : '只能输入 portrait 或 landscape。',
            });
            config.game.offlineGame = await askBoolean(rl, '是否为单机游戏', config.game.offlineGame);
        } else if (section === 'sdk') {
            config.sdk ||= {};
            config.sdk.gameCenterAppKey = await askValue(rl, '游戏中心 app_key', {
                defaultValue: isMissingConfigValue(config.sdk.gameCenterAppKey) ? undefined : config.sdk.gameCenterAppKey,
            });
            config.sdk.providerAppId = await askValue(rl, '广告 Provider App ID', {
                defaultValue: isMissingConfigValue(config.sdk.providerAppId) ? undefined : config.sdk.providerAppId,
            });
            config.sdk.supplierAppId = await askValue(rl, 'OPPO supplier/MobAd App ID', {
                defaultValue: isMissingConfigValue(config.sdk.supplierAppId) ? undefined : config.sdk.supplierAppId,
            });
        } else {
            config.privacy ||= {};
            config.privacy.policyUrl = await askValue(rl, '隐私协议 HTTPS URL', {
                defaultValue: isMissingConfigValue(config.privacy.policyUrl) ? undefined : config.privacy.policyUrl,
                validate: (answer) => /^https:\/\//.test(answer) ? null : '必须是 HTTPS URL。',
            });
            config.privacy.skipBeforeTime = await askValue(rl, '隐私策略截止时间 YYYY-MM-DD HH:mm:ss', {
                defaultValue: isMissingConfigValue(config.privacy.skipBeforeTime) ? undefined : config.privacy.skipBeforeTime,
                validate: (answer) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(answer) ? null : '时间格式不正确。',
            });
        }
    } finally {
        rl.close();
    }
    const backup = join(project, 'build', 'glory-cli', 'backups', timestamp(), basename(loaded.path));
    mkdirSync(dirname(backup), { recursive: true });
    writeFileSync(backup, readFileSync(loaded.path, 'utf8'), 'utf8');
    writeFileSync(loaded.path, serializeConfig(loaded.path, config), 'utf8');
    console.log(`\n${section} 已保存。再运行 glory-game configure 填下一组；也可以先停。`);
}

async function interactiveConfig(project) {
    const value = initialConfig(project);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(`检测到 Cocos 工程：${project}`);
    console.log(`已复用配置：${value.profile}（Cocos/Java/Gradle/NDK/ABI/SDK 版本）`);
    console.log('初始化只问包名。启动场景、方向、NDK、AGP、SDK 地址都用识别结果或默认值。广告和隐私以后改宿主文件。\n');
    try {
        value.game.packageName = await askValue(rl, 'Android packageName', {
            validate: (answer) => /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(answer) ? null : '不是有效的 Android 包名。',
        });
        if (isMissingConfigValue(value.cocos.startScene)) {
            value.cocos.startScene = await askStartScene(rl, project);
        } else {
            const detected = detectStartScene(project);
            console.log(`启动场景已识别：${value.cocos.startScene}${detected?.reason ? `（${detected.reason}）` : ''}`);
        }
        return value;
    } finally {
        rl.close();
    }
}

async function initConfig(project, options) {
    const value = initialConfig(project);
    if (options.stdout) {
        const format = String(options.format || 'yaml');
        if (!['yaml', 'json'].includes(format)) throw new CliError('--format 只能是 yaml 或 json');
        process.stdout.write(format === 'json' ? `${JSON.stringify(value, null, 2)}\n` : YAML.stringify(value, { indent: 2, lineWidth: 0 }));
        return;
    }
    const output = options.output
        ? (isAbsolute(String(options.output)) ? resolve(String(options.output)) : resolve(project, String(options.output)))
        : join(project, DEFAULT_CONFIG);
    if (existsSync(output)) throw new CliError(`配置文件已存在，为避免覆盖已停止：${output}`);
    const interactive = !options['non-interactive'] && process.stdin.isTTY && process.stdout.isTTY;
    const configuredValue = interactive ? await interactiveConfig(project) : value;
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, serializeConfig(output, configuredValue), 'utf8');
    rememberProject(project);
    console.log(`已生成配置：${output}`);
    if (!interactive) console.log('包名仍是 REQUIRED，请填写后使用。其余字段已用识别结果或默认值。');
    else {
        console.log('初始化完成。下一步：');
        console.log('glory-game apply');
        console.log('glory-game cocos-build');
    }
}

function gitRepositoryRoot(project) {
    const result = spawnSync('git', ['-C', project, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    return result.status === 0 ? result.stdout.trim() : null;
}

function gitIgnoresNative(project) {
    const result = spawnSync('git', ['check-ignore', '--no-index', '-q', 'native/.glory-cli-probe'], {
        cwd: project,
        encoding: 'utf8',
    });
    return result.status === 0;
}

function parseLocalProperties(path) {
    const values = {};
    for (const line of readText(path).split(/\r?\n/)) {
        if (!line || line.trim().startsWith('#')) continue;
        const index = line.indexOf('=');
        if (index === -1) continue;
        values[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\');
    }
    return values;
}

function findGeneratedProject(project) {
    const buildRoot = join(project, 'build');
    if (!existsSync(buildRoot)) return null;
    const matches = [];
    for (const name of readdirSync(buildRoot)) {
        const candidate = join(buildRoot, name, 'proj');
        if (existsSync(join(candidate, 'gradlew'))) {
            matches.push({ path: candidate, mtime: statSync(candidate).mtimeMs });
        }
    }
    return matches.sort((a, b) => b.mtime - a.mtime)[0]?.path || null;
}

function resolveAndroidSdk(project, config, generatedProject) {
    const localSdk = generatedProject
        ? parseLocalProperties(join(generatedProject, 'local.properties'))['sdk.dir']
        : null;
    return firstExisting([
        config?.android?.sdkDir,
        process.env.ANDROID_SDK_ROOT,
        process.env.ANDROID_HOME,
        localSdk,
        join(homedir(), 'Library', 'Android', 'sdk'),
    ]);
}

function javaMajorOf(version) {
    if (!version) return null;
    return version.startsWith('1.') ? Number(version.split('.')[1]) : Number(version.split('.')[0]);
}

function sdkComponentPath(androidSdk, folder, version) {
    if (!androidSdk || !version) return null;
    return join(androidSdk, folder, String(version));
}

function assertRequiredToolchain(inspection, config, commandLabel) {
    const fails = [];
    if (!inspection.creator.path) {
        fails.push(`未找到 Cocos Creator ${config.cocos.version}，请安装到 /Applications/Cocos/Creator/${config.cocos.version}/`);
    }
    const javaMajor = javaMajorOf(inspection.java.version);
    if (!inspection.java.path || javaMajor !== inspection.java.requiredMajor) {
        fails.push(`需要 JDK ${inspection.java.requiredMajor}，当前是 ${inspection.java.version || '未安装'}。macOS 可执行：/usr/libexec/java_home -v ${inspection.java.requiredMajor}`);
    }
    if (!inspection.androidSdk) {
        fails.push('未找到 Android SDK。设置 ANDROID_SDK_ROOT，或安装到 ~/Library/Android/sdk');
    }
    const required = [
        ['platforms', config.android?.compileSdk ? `android-${config.android.compileSdk}` : null, `compileSdk ${config.android?.compileSdk}`],
        ['build-tools', config.android?.buildToolsVersion, `Build Tools ${config.android?.buildToolsVersion}`],
        ['ndk', config.android?.ndkVersion, `NDK ${config.android?.ndkVersion}`],
        ['cmake', config.android?.cmakeVersion, `CMake ${config.android?.cmakeVersion}`],
    ];
    for (const [folder, version, label] of required) {
        const target = sdkComponentPath(inspection.androidSdk, folder, version);
        if (target && !existsSync(target)) {
            fails.push(`需要 ${label}，请用 SDK Manager 安装到：${target}`);
        }
    }
    if (fails.length) {
        throw new CliError(`${commandLabel} 本机工具链必须和 glory-game.yaml 一致，缺一不可：\n- ${fails.join('\n- ')}`);
    }
}

function addCheck(checks, id, status, message, details = {}) {
    checks.push({ id, status, message, ...details });
}

function includesAll(path, fragments) {
    const content = readText(path);
    return fragments.every((fragment) => content.includes(fragment));
}

function inspectProject(project, config) {
    const checks = [];
    const projectPackage = readJson(join(project, 'package.json'), 'Cocos package.json');
    const projectCreatorVersion = projectPackage.creator?.version || null;
    const expectedCreatorVersion = config?.cocos?.version || projectCreatorVersion;
    addCheck(
        checks,
        'cocos.project-version',
        projectCreatorVersion ? 'pass' : 'fail',
        projectCreatorVersion ? `项目声明 Cocos Creator ${projectCreatorVersion}` : 'package.json 未声明 Creator 版本',
    );
    if (config && projectCreatorVersion !== config.cocos.version) {
        addCheck(checks, 'cocos.version-match', 'fail', `项目版本 ${projectCreatorVersion} 与配置版本 ${config.cocos.version} 不一致`);
    } else if (config) {
        addCheck(checks, 'cocos.version-match', 'pass', `Creator 版本与配置一致：${config.cocos.version}`);
    }

    const creator = creatorExecutable(expectedCreatorVersion, config);
    addCheck(
        checks,
        'cocos.executable',
        creator.path ? 'pass' : 'fail',
        creator.path ? `Creator 可执行文件：${creator.path}` : `未找到 Cocos Creator ${expectedCreatorVersion}`,
        { path: creator.path || null },
    );

    const templateToolchain = creatorAndroidToolchain(creator.path);
    if (templateToolchain) {
        addCheck(
            checks,
            'cocos.android-toolchain',
            'pass',
            `Creator Android 模板：AGP ${templateToolchain.agpVersion} / Gradle ${templateToolchain.gradleVersion} / JDK ${templateToolchain.javaVersion}`,
            templateToolchain,
        );
    }

    const java = resolveJava(config, templateToolchain?.javaVersion || 11);
    const javaMajor = java.version?.startsWith('1.') ? Number(java.version.split('.')[1]) : Number(java.version?.split('.')[0]);
    addCheck(
        checks,
        'java.build-jdk',
        java.path && javaMajor === java.requiredMajor ? 'pass' : 'fail',
        java.path ? `构建 JDK：${java.version} (${java.path})，要求 JDK ${java.requiredMajor}` : `未找到 JDK ${java.requiredMajor}`,
        { path: java.path, version: java.version },
    );
    if (java.shellVersion) {
        const shellMajor = java.shellVersion.startsWith('1.') ? Number(java.shellVersion.split('.')[1]) : Number(java.shellVersion.split('.')[0]);
        addCheck(
            checks,
            'java.shell-jdk',
            shellMajor === java.requiredMajor ? 'pass' : 'warn',
            `当前终端 JAVA_HOME：${java.shellVersion} (${java.shellPath})`,
        );
    } else {
        addCheck(checks, 'java.shell-jdk', 'warn', '当前终端未设置 JAVA_HOME');
    }

    const generatedProject = findGeneratedProject(project);
    const androidSdk = resolveAndroidSdk(project, config, generatedProject);
    addCheck(
        checks,
        'android.sdk',
        androidSdk ? 'pass' : 'fail',
        androidSdk ? `Android SDK：${androidSdk}` : '未找到 Android SDK',
        { path: androidSdk || null },
    );

    const required = config?.android || {};
    for (const [id, folder, version] of [
        ['android.platform', 'platforms', required.compileSdk ? `android-${required.compileSdk}` : null],
        ['android.build-tools', 'build-tools', required.buildToolsVersion],
        ['android.ndk', 'ndk', required.ndkVersion],
        ['android.cmake', 'cmake', required.cmakeVersion],
    ]) {
        if (!version || !androidSdk) continue;
        const target = join(androidSdk, folder, String(version));
        addCheck(checks, id, existsSync(target) ? 'pass' : 'fail', `${id.split('.').at(-1)} ${version}${existsSync(target) ? ' 已安装' : ' 未安装'}`, { path: target });
    }

    const nativeRoot = join(project, 'native', 'engine', 'android');
    const nativeExists = existsSync(nativeRoot);
    const nativeIgnored = gitIgnoresNative(project);
    addCheck(
        checks,
        'source.native-tracked',
        nativeIgnored ? 'warn' : 'pass',
        nativeIgnored ? '当前 .gitignore 会忽略 native/，生成的 Android 模板无法纳入版本控制' : 'native/ 未被 Git 忽略',
    );
    addCheck(
        checks,
        'android.native-template',
        nativeExists ? 'pass' : 'warn',
        nativeExists ? `已有 Cocos Android 原生模板：${nativeRoot}` : '尚未生成 Cocos Android 原生模板',
        { path: nativeRoot },
    );

    const imagerPath = join(project, 'settings', 'v2', 'packages', 'imager.json');
    if (existsSync(imagerPath)) {
        const imager = readJson(imagerPath, '图片压缩插件配置');
        const externalOutput = imager.isAutoStart === '1'
            && isAbsolute(imager.outDir || '')
            && !resolve(imager.outDir).startsWith(`${project}/`);
        addCheck(
            checks,
            'cocos.imager-output',
            externalOutput ? 'warn' : 'pass',
            externalOutput
                ? `图片压缩插件使用其他机器的目录：${imager.outDir}`
                : '图片压缩插件未绑定其他机器的输出目录',
            { path: imager.outDir || null },
        );
    }

    const jsAdapterLayout = detectJsAdapterLayout(project);
    addCheck(
        checks,
        'glory.js-adapter',
        jsAdapterLayout ? 'pass' : 'warn',
        jsAdapterLayout ? `APK JS 广告适配层已存在：${jsAdapterLayout.name}` : '未识别到完整的 APK JS 广告适配层',
        { layout: jsAdapterLayout?.name || null },
    );

    if (nativeExists) {
        const manifest = join(nativeRoot, 'app', 'AndroidManifest.xml');
        const appGradle = join(nativeRoot, 'app', 'build.gradle');
        const appActivity = join(nativeRoot, 'app', 'src', 'com', 'cocos', 'game', 'AppActivity.java');
        const application = join(nativeRoot, 'app', 'src', 'com', 'cocos', 'game', 'MyApplication.java');
        const proguard = join(nativeRoot, 'app', 'proguard-rules.pro');
        const settings = join(nativeRoot, 'cocos-settings.gradle');
        const supplier = join(nativeRoot, 'app', 'assets', 'supplierconfig.json');
        const sdk = join(nativeRoot, 'glory-adsdk');
        addCheck(checks, 'glory.sdk-module', existsSync(sdk) ? 'pass' : 'warn', existsSync(sdk) ? 'glory-adsdk 模块已存在' : '缺少 glory-adsdk 模块');
        if (existsSync(sdk) && config?.sdk?.commit) {
            const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: sdk, encoding: 'utf8' });
            const actualCommit = commitResult.status === 0 ? commitResult.stdout.trim() : null;
            addCheck(
                checks,
                'glory.sdk-commit',
                actualCommit === config.sdk.commit ? 'pass' : 'warn',
                actualCommit === config.sdk.commit ? `SDK commit 已固定：${actualCommit}` : `SDK commit 不一致：期望 ${config.sdk.commit}，实际 ${actualCommit || '无法读取'}`,
                { expected: config.sdk.commit, actual: actualCommit },
            );
        }
        addCheck(checks, 'glory.manifest', includesAll(manifest, ['com.cocos.game.MyApplication', 'com.glory.adsdk.launch.GloryAdLaunchActivity']) ? 'pass' : 'warn', 'Manifest 的 Application/Launcher 接入');
        addCheck(checks, 'glory.app-gradle', includesAll(appGradle, ["project(':glory-adsdk')", 'multiDexEnabled true']) ? 'pass' : 'warn', 'app Gradle 的 SDK/MultiDex 接入');
        addCheck(checks, 'glory.app-activity', includesAll(appActivity, ['AdSdk.onMainActivityReady', 'AdSdk.onBackPressed']) ? 'pass' : 'warn', 'AppActivity 的 SDK 生命周期接入');
        addCheck(checks, 'glory.application', includesAll(application, ['AdSdk.init', 'AdSdkConfig']) ? 'pass' : 'warn', 'MyApplication 的 SDK 初始化');
        addCheck(checks, 'glory.proguard', includesAll(proguard, ['com.nearme.**', 'com.glorious.**', 'com.heytap.**']) ? 'pass' : 'warn', 'OPPO/GameCenter 的 R8 混淆保护');
        addCheck(checks, 'glory.supplier-config', existsSync(supplier) ? 'pass' : 'warn', existsSync(supplier) ? 'supplierconfig.json 已存在' : '缺少 supplierconfig.json');
        addCheck(checks, 'glory.cocos-settings', includesAll(settings, ["include ':libcocos', ':libservice', ':app', ':glory-adsdk'", "project(':glory-adsdk')"]) ? 'pass' : 'warn', 'Cocos Gradle 模板的 SDK 模块接入');

        if (config) {
            const manifestContent = readText(manifest);
            const applicationContent = readText(application);
            const supplierConfig = existsSync(supplier) ? readJson(supplier, 'supplierconfig.json') : null;
            const identityMatches = manifestContent.includes(`package="${config.game.packageName}"`)
                && applicationContent.includes(`import ${config.game.packageName}.BuildConfig;`);
            addCheck(checks, 'config.game-identity', identityMatches ? 'pass' : 'warn', identityMatches ? '包名和 BuildConfig 与接入配置一致' : '包名或 BuildConfig 与接入配置不一致');
            if (config.sdk?.providerAppId) {
                const providerMatches = applicationContent.includes(`config.adProviderAppId = "${config.sdk.providerAppId}";`);
                addCheck(checks, 'config.provider-app-id', providerMatches ? 'pass' : 'warn', providerMatches ? '广告 Provider App ID 与配置一致' : '广告 Provider App ID 与配置不一致');
            }
            if (config.sdk?.supplierAppId) {
                const supplierMatches = supplierConfig?.supplier?.oppo?.appid === config.sdk.supplierAppId;
                addCheck(checks, 'config.supplier-app-id', supplierMatches ? 'pass' : 'warn', supplierMatches ? 'supplier OPPO App ID 与配置一致' : 'supplier OPPO App ID 与配置不一致');
            }
            if (config.sdk?.gameCenterAppKey) {
                const gameCenterKeyMatches = manifestContent.includes(`android:name="app_key" android:value="${config.sdk.gameCenterAppKey}"`);
                addCheck(checks, 'config.game-center-app-key', gameCenterKeyMatches ? 'pass' : 'warn', gameCenterKeyMatches ? '游戏中心 app_key 与配置一致' : '游戏中心 app_key 与配置不一致');
            }
            if (config.privacy?.policyUrl && config.privacy?.skipBeforeTime) {
                const privacyMatches = applicationContent.includes(`privacyConfig.privacyPolicyUrl = "${config.privacy.policyUrl}";`)
                    && applicationContent.includes(`config.skipPrivacyBeforeTime = "${config.privacy.skipBeforeTime}";`);
                addCheck(checks, 'config.privacy', privacyMatches ? 'pass' : 'warn', privacyMatches ? '隐私地址和时间策略与配置一致' : '隐私地址或时间策略与配置不一致');
            }
            const secretEnv = config.sdk?.gameCenterAppSecretEnv;
            addCheck(
                checks,
                'config.game-center-secret',
                secretEnv && process.env[secretEnv] ? 'pass' : 'warn',
                secretEnv && process.env[secretEnv] ? `游戏中心密钥环境变量 ${secretEnv} 已设置` : `游戏中心密钥环境变量 ${secretEnv || '(未配置)'} 未设置`,
            );
        }
    }

    return {
        project,
        repositoryRoot: gitRepositoryRoot(project),
        projectName: projectPackage.name || basename(project),
        projectCreatorVersion,
        expectedCreatorVersion,
        creator,
        templateToolchain,
        java,
        androidSdk,
        generatedProject,
        nativeRoot,
        nativeExists,
        jsAdapterLayout: jsAdapterLayout?.name || null,
        checks,
    };
}

function statusIcon(status) {
    return status === 'pass' ? '✓' : status === 'warn' ? '!' : '✗';
}

function printInspection(result, asJson) {
    if (asJson) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(`项目：${result.projectName}`);
    console.log(`目录：${result.project}\n`);
    for (const check of result.checks) {
        console.log(`${statusIcon(check.status)} [${check.status.toUpperCase()}] ${check.message}`);
    }
    const fail = result.checks.filter((item) => item.status === 'fail').length;
    const warn = result.checks.filter((item) => item.status === 'warn').length;
    console.log(`\n结果：${fail} 个失败，${warn} 个待确认`);
}

function buildPlan(project, config, inspection) {
    const path = (...parts) => join(project, ...parts);
    const done = (id) => inspection.checks.find((item) => item.id === id)?.status === 'pass';
    const isDoudoupinLayout = inspection.jsAdapterLayout === 'assets/AdSdk/script/platform/Native';
    const steps = [];
    steps.push({
        id: 'js-adapter',
        status: done('glory.js-adapter') ? 'done' : 'change',
        sourceCommit: isDoudoupinLayout ? '0bf0925 (当前 main)' : '1e83a36',
        description: '应用 APK JS AD SDK 适配层',
    });
    steps.push({
        id: 'track-native',
        status: done('source.native-tracked') ? 'done' : 'change',
        description: '调整 .gitignore，使 native/ Android 模板进入版本控制',
        files: [path('.gitignore')],
    });
    steps.push({
        id: 'cocos-bootstrap',
        status: inspection.nativeExists ? 'done' : 'change',
        sourceCommit: '3820294',
        description: inspection.nativeExists ? 'Cocos Android 原生模板已生成' : '调用 Creator 生成 Cocos Android 原生模板',
    });
    for (const [id, checkId, sourceCommit, description, files] of [
        ['sdk-module', 'glory.sdk-module', '481cd6f/5552bcd', '添加并固定 glory-adsdk 子模块', ['.gitmodules', 'native/engine/android/glory-adsdk']],
        ['manifest', 'glory.manifest', '481cd6f', '接入 MyApplication 和 GloryAdLaunchActivity', ['native/engine/android/app/AndroidManifest.xml']],
        ['app-gradle', 'glory.app-gradle', '481cd6f', '接入 SDK 依赖、AAR、MultiDex 和 assets', ['native/engine/android/app/build.gradle']],
        ['app-activity', 'glory.app-activity', '481cd6f', '接入 SDK 主 Activity 生命周期与返回键', ['native/engine/android/app/src/com/cocos/game/AppActivity.java']],
        ['application', 'glory.application', '481cd6f/934c50f/58fb816', '生成当前游戏 MyApplication 配置', ['native/engine/android/app/src/com/cocos/game/MyApplication.java']],
        ['supplier', 'glory.supplier-config', '481cd6f', '生成 supplierconfig.json', ['native/engine/android/app/assets/supplierconfig.json']],
        ['cocos-settings', 'glory.cocos-settings', 'd7968d4', '生成包含 glory-adsdk 的 cocos-settings.gradle', ['native/engine/android/cocos-settings.gradle']],
    ]) {
        steps.push({ id, status: done(checkId) ? 'done' : 'change', sourceCommit, description, files: files.map((file) => path(...file.split('/'))) });
    }

    const manifest = readText(path('native', 'engine', 'android', 'app', 'AndroidManifest.xml'));
    const application = readText(path('native', 'engine', 'android', 'app', 'src', 'com', 'cocos', 'game', 'MyApplication.java'));
    const packageName = config.game.packageName;
    steps.push({
        id: 'game-identity',
        status: manifest.includes(`package="${packageName}"`) && application.includes(`import ${packageName}.BuildConfig;`) ? 'done' : 'change',
        sourceCommit: '934c50f/58fb816',
        description: `统一 Android 包名和 BuildConfig：${packageName}`,
    });
    steps.push({ id: 'cocos-final-build', status: 'required', description: `使用 Creator ${config.cocos.version} 生成最终 Android 工程` });
    steps.push({ id: 'gradle-build', status: 'required', description: `使用 JDK ${inspection.java.requiredMajor} 编译 Debug/Release APK` });
    steps.push({ id: 'apk-verify', status: 'required', description: '校验 APK 包名、版本、签名、ABI、Launcher 和 assets' });
    return { project, config: config.game, steps };
}

function printPlan(plan, asJson) {
    if (asJson) {
        console.log(JSON.stringify(plan, null, 2));
        return;
    }
    console.log(`接入计划：${plan.config.name} (${plan.config.packageName})\n`);
    for (const step of plan.steps) {
        const icon = step.status === 'done' ? '✓' : step.status === 'change' ? '△' : '→';
        const commit = step.sourceCommit ? ` [${step.sourceCommit}]` : '';
        console.log(`${icon} ${step.id.padEnd(20)} ${step.status.padEnd(8)} ${step.description}${commit}`);
    }
    const changes = plan.steps.filter((step) => step.status === 'change').length;
    console.log(`\n需要修改 ${changes} 个接入步骤；本命令未修改文件。`);
}

function loadAndroidProfile(project) {
    const path = join(project, 'profiles', 'v2', 'packages', 'android.json');
    if (!existsSync(path)) return { common: {}, options: {} };
    const profile = readJson(path, 'Cocos Android profile');
    return {
        common: profile.builder?.common || {},
        options: profile.builder?.options?.android || {},
    };
}

function timestamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function orientationValue(value) {
    return {
        portrait: value !== 'landscape',
        upsideDown: false,
        landscapeRight: value === 'landscape',
        landscapeLeft: value === 'landscape',
    };
}

function createCocosBuildConfig(project, config, mode, outputName, toolchain = {}) {
    const profile = loadAndroidProfile(project);
    const androidOptions = {
        ...profile.options,
        packageName: config.game.packageName,
        orientation: orientationValue(config.game.orientation || 'portrait'),
        apiLevel: config.cocos.apiLevel,
        appABIs: config.cocos.appABIs,
        // Creator 只负责生成工程；最终 Release 签名由 android-build 通过环境变量注入。
        useDebugKeystore: true,
        appBundle: false,
        androidInstant: false,
        inputSDK: false,
        renderBackEnd: config.cocos.renderBackEnd || profile.options.renderBackEnd || { vulkan: false, gles3: true, gles2: true },
        __version__: profile.options.__version__ || '1.0.1',
    };
    if (toolchain.sdkPath) androidOptions.sdkPath = toolchain.sdkPath;
    if (toolchain.ndkPath) androidOptions.ndkPath = toolchain.ndkPath;
    if (toolchain.javaHome) androidOptions.javaHome = toolchain.javaHome;
    const buildRoot = resolve(project, config.cocos.buildRoot || 'build');
    const buildConfig = {
        taskName: 'android',
        name: config.game.name,
        platform: 'android',
        buildPath: buildRoot,
        outputName,
        debug: mode === 'debug',
        md5Cache: false,
        mainBundleCompressionType: profile.common.mainBundleCompressionType || 'merge_dep',
        packages: { android: androidOptions },
    };
    const startScene = resolveBuildStartScene(project, config);
    buildConfig.startScene = startScene.uuid;
    return { buildConfig, buildRoot, outputPath: join(buildRoot, outputName), startScene };
}

function runProcess(command, args, options = {}) {
    return new Promise((resolvePromise, rejectPromise) => {
        const transcript = options.transcriptPath ? createWriteStream(options.transcriptPath, { flags: 'a' }) : null;
        let diagnosticTail = '';
        const relay = (target) => (chunk) => {
            if (!options.quiet) target.write(chunk);
            transcript?.write(chunk);
            diagnosticTail = `${diagnosticTail}${chunk.toString('utf8')}`.slice(-5 * 1024 * 1024);
        };
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env || process.env,
            stdio: ['inherit', 'pipe', 'pipe'],
        });
        child.stdout.on('data', relay(process.stdout));
        child.stderr.on('data', relay(process.stderr));
        let timedOut = false;
        const timeout = options.timeoutMs
            ? setTimeout(() => {
                timedOut = true;
                child.kill('SIGTERM');
            }, options.timeoutMs)
            : null;
        child.on('error', (error) => {
            transcript?.end();
            rejectPromise(error);
        });
        child.on('exit', (code, signal) => {
            if (timeout) clearTimeout(timeout);
            const result = { code, signal, timedOut, diagnosticTail };
            if (transcript) transcript.end(() => resolvePromise(result));
            else resolvePromise(result);
        });
    });
}

async function ensureProjectDependencies(project, dryRun) {
    const packagePath = join(project, 'package.json');
    const pkg = readJson(packagePath, 'Cocos package.json');
    const names = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    const missing = names.filter((name) => !existsSync(join(project, 'node_modules', ...name.split('/'), 'package.json')));
    if (!missing.length) return;
    if (!existsSync(join(project, 'package-lock.json'))) {
        throw new CliError(`项目依赖尚未安装：${missing.join('、')}；当前最小实现仅自动支持含 package-lock.json 的项目`);
    }
    console.log(`项目依赖缺失：${missing.join('、')}`);
    if (dryRun) {
        console.log('DRY RUN：正式执行时会运行 npm install --ignore-scripts。');
        return;
    }
    console.log('自动安装 package-lock.json 声明的依赖（禁用生命周期脚本）...');
    const result = await runProcess('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: project });
    if (result.code !== 0) throw new CliError(`npm install 失败，退出码 ${result.code ?? 'null'}`);
    const unresolved = missing.filter((name) => !existsSync(join(project, 'node_modules', ...name.split('/'), 'package.json')));
    if (unresolved.length) throw new CliError(`依赖安装完成后仍缺少：${unresolved.join('、')}`);
    console.log('✓ Cocos 项目依赖安装完成');
}

function verifyCocosOutput(outputPath) {
    const required = [
        'data/main.js',
        'data/assets',
        'proj/gradlew',
        'proj/settings.gradle',
        'proj/gradle.properties',
        'proj/cfg.cmake',
    ];
    return required.map((relativePath) => ({
        path: join(outputPath, relativePath),
        exists: existsSync(join(outputPath, relativePath)),
    }));
}

function findFiles(root, predicate, results = []) {
    if (!existsSync(root)) return results;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) findFiles(path, predicate, results);
        else if (predicate(path)) results.push(path);
    }
    return results;
}

function runCapture(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) {
        throw new CliError(`${basename(command)} 执行失败：${(result.stderr || result.stdout || '').trim()}`);
    }
    return `${result.stdout || ''}${result.stderr || ''}`;
}

function parseQuotedFields(line) {
    return [...line.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

function releaseSigning(project, config, mode, dryRun = false) {
    if (mode !== 'release') return null;
    const signing = config.android?.signing;
    const errors = [];
    for (const [name, value] of [
        ['android.signing.storeFile', signing?.storeFile],
        ['android.signing.storePasswordEnv', signing?.storePasswordEnv],
        ['android.signing.keyAlias', signing?.keyAlias],
        ['android.signing.keyPasswordEnv', signing?.keyPasswordEnv],
    ]) {
        if (!value || String(value).startsWith('REQUIRED')) errors.push(`缺少 ${name}`);
    }
    const storeFile = signing?.storeFile
        ? (isAbsolute(signing.storeFile) ? resolve(signing.storeFile) : resolve(project, signing.storeFile))
        : null;
    if (storeFile && !existsSync(storeFile)) errors.push(`签名文件不存在：${storeFile}`);
    const storePassword = signing?.storePasswordEnv ? process.env[signing.storePasswordEnv] : null;
    const keyPassword = signing?.keyPasswordEnv ? process.env[signing.keyPasswordEnv] : null;
    if (!dryRun && !storePassword) errors.push(`缺少签名密码环境变量：${signing?.storePasswordEnv || '(未配置)'}`);
    if (!dryRun && !keyPassword) errors.push(`缺少别名密码环境变量：${signing?.keyPasswordEnv || '(未配置)'}`);
    if (errors.length) throw new CliError(`Release 签名配置不完整：\n- ${errors.join('\n- ')}`);
    return { ...signing, storeFile, storePassword, keyPassword };
}

function verifyApk(apk, config, androidSdk, asJson = false) {
    const apkPath = resolve(apk);
    if (!existsSync(apkPath)) throw new CliError(`APK 不存在：${apkPath}`);
    if (!androidSdk) throw new CliError('未找到 Android SDK，无法验证 APK');
    const buildTools = config.android.buildToolsVersion;
    const aapt = join(androidSdk, 'build-tools', buildTools, 'aapt');
    const apksigner = join(androidSdk, 'build-tools', buildTools, 'apksigner');
    for (const path of [aapt, apksigner]) {
        if (!existsSync(path)) throw new CliError(`缺少 APK 检查工具：${path}`);
    }
    const badging = runCapture(aapt, ['dump', 'badging', apkPath]);
    const packageLine = badging.split(/\r?\n/).find((line) => line.startsWith('package:')) || '';
    const packageName = packageLine.match(/name='([^']+)'/)?.[1] || null;
    const versionCode = Number(packageLine.match(/versionCode='([^']+)'/)?.[1]);
    const versionName = packageLine.match(/versionName='([^']+)'/)?.[1] || null;
    const launcherLine = badging.split(/\r?\n/).find((line) => line.startsWith('launchable-activity:')) || '';
    const launcher = launcherLine.match(/name='([^']+)'/)?.[1] || null;
    const nativeLine = badging.split(/\r?\n/).find((line) => line.startsWith('native-code:')) || '';
    const abis = parseQuotedFields(nativeLine);
    const entries = runCapture('/usr/bin/unzip', ['-Z1', apkPath]).split(/\r?\n/);
    const signature = runCapture(apksigner, ['verify', '--print-certs', apkPath]);
    const signerDn = signature.match(/Signer #1 certificate DN:\s*(.+)/)?.[1]?.trim() || null;
    const signerSha256 = signature.match(/Signer #1 certificate SHA-256 digest:\s*([0-9a-f:]+)/i)?.[1]?.replace(/:/g, '').toLowerCase() || null;
    const checks = [
        { id: 'package', status: packageName === config.game.packageName ? 'pass' : 'fail', expected: config.game.packageName, actual: packageName },
        { id: 'versionCode', status: versionCode === config.game.versionCode ? 'pass' : 'fail', expected: config.game.versionCode, actual: versionCode },
        { id: 'versionName', status: versionName === config.game.versionName ? 'pass' : 'fail', expected: config.game.versionName, actual: versionName },
        { id: 'launcher', status: launcher === 'com.glory.adsdk.launch.GloryAdLaunchActivity' ? 'pass' : 'fail', expected: 'com.glory.adsdk.launch.GloryAdLaunchActivity', actual: launcher },
        { id: 'abis', status: config.cocos.appABIs.every((abi) => abis.includes(abi)) ? 'pass' : 'fail', expected: config.cocos.appABIs, actual: abis },
        { id: 'supplier-config', status: entries.includes('assets/supplierconfig.json') ? 'pass' : 'fail', expected: true, actual: entries.includes('assets/supplierconfig.json') },
        { id: 'signature', status: /CocosCreator|Android Debug/i.test(signerDn || '') ? 'warn' : 'pass', expected: '非调试证书', actual: signerDn },
    ];
    const expectedSha256 = config.android?.signing?.certificateSha256?.replace(/:/g, '').toLowerCase();
    if (expectedSha256) {
        checks.push({ id: 'signature-sha256', status: signerSha256 === expectedSha256 ? 'pass' : 'fail', expected: expectedSha256, actual: signerSha256 });
    }
    const report = { apk: apkPath, packageName, versionCode, versionName, launcher, abis, signerDn, signerSha256, checks };
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else {
        console.log(`APK 验证：${apkPath}`);
        for (const check of checks) {
            console.log(`${statusIcon(check.status)} [${check.status.toUpperCase()}] ${check.id}: ${JSON.stringify(check.actual)}`);
        }
    }
    return report;
}

function replaceRequired(content, pattern, replacement, label) {
    if (!pattern.test(content)) throw new CliError(`无法识别 ${label}，停止自动修改`);
    pattern.lastIndex = 0;
    return content.replace(pattern, replacement);
}

function setGradleProperty(content, name, value) {
    const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
    if (pattern.test(content)) return content.replace(pattern, `${name}=${value}`);
    return `${content.trimEnd()}\n${name}=${value}\n`;
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeJava(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function escapeGroovySingle(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function setXmlAttribute(tag, name, value, indent = '        ') {
    const pattern = new RegExp(`\\s${escapeRegExp(name)}="[^"]*"`);
    if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${escapeXml(value)}"`);
    return tag.replace(/\s*(\/?)>$/, `\n${indent}${name}="${escapeXml(value)}"$1>`);
}

function transformManifest(content, config) {
    if (!content.includes('com.cocos.game.AppActivity') || !content.includes('com.cocos.lib.CocosEditBoxActivity')) {
        throw new CliError('AndroidManifest.xml 不是可识别的 Cocos 3.8 模板，停止自动修改');
    }
    let output = content;
    output = output.replace(/<manifest\b[^>]*>/, (tag) => {
        let next = setXmlAttribute(tag, 'xmlns:tools', 'http://schemas.android.com/tools', '    ');
        next = setXmlAttribute(next, 'package', config.game.packageName, '    ');
        return next;
    });
    if (!output.includes('com.gcsdk.msp.duidprovider')) {
        const queries = `    <queries>\n        <provider\n            android:authorities="com.gcsdk.msp.duidprovider"\n            tools:replace="android:authorities" />\n        <provider\n            android:authorities="com.oplus.statistics.provider"\n            tools:replace="android:authorities" />\n    </queries>\n\n`;
        output = output.replace(/(\s*<uses-permission)/, `\n${queries}$1`);
    }
    if (!output.includes('android.permission.VIBRATE')) {
        output = output.replace(/(\s*<application\b)/, '\n    <uses-permission android:name="android.permission.VIBRATE" />\n$1');
    }
    output = output.replace(/<application\b[^>]*>/, (tag) => {
        let next = setXmlAttribute(tag, 'android:name', 'com.cocos.game.MyApplication');
        next = setXmlAttribute(next, 'android:requestLegacyExternalStorage', 'true');
        next = setXmlAttribute(next, 'android:appComponentFactory', 'androidx.core.app.CoreComponentFactory');
        next = setXmlAttribute(next, 'tools:replace', 'android:allowBackup,android:appComponentFactory');
        return next;
    });

    const metadata = [
        ['debug_mode', 'false'],
        ['is_offline_game', String(config.game.offlineGame)],
        ['app_key', config.sdk.gameCenterAppKey],
    ];
    for (const [name, value] of metadata) {
        const pattern = new RegExp(`<meta-data\\s+android:name="${escapeRegExp(name)}"[^>]*/>`);
        const tag = `<meta-data android:name="${name}" android:value="${escapeXml(value)}" />`;
        if (pattern.test(output)) output = output.replace(pattern, tag);
        else output = output.replace(/(\s*<activity\b)/, `\n        ${tag}\n$1`);
    }
    if (!output.includes('org.apache.http.legacy')) {
        output = output.replace(/(\s*<activity\b)/, '\n        <uses-library android:name="org.apache.http.legacy" android:required="false" />\n$1');
    }

    const appActivityPattern = /<activity\b[^>]*android:name="com\.cocos\.game\.AppActivity"[\s\S]*?<\/activity>/;
    if (!appActivityPattern.test(output)) throw new CliError('无法定位 Cocos AppActivity 声明，停止自动修改');
    output = output.replace(appActivityPattern, (block) => {
        let next = block.replace(/<activity\b[^>]*>/, (tag) => setXmlAttribute(tag, 'android:screenOrientation', config.game.orientation, '            '));
        next = next.replace(/\s*<intent-filter>[\s\S]*?android\.intent\.action\.MAIN[\s\S]*?android\.intent\.category\.LAUNCHER[\s\S]*?<\/intent-filter>/, '');
        return next;
    });

    const launchActivity = `        <!-- glory-game-managed:v1 -->\n        <activity\n            android:name="com.glory.adsdk.launch.GloryAdLaunchActivity"\n            android:label="@string/app_name"\n            android:screenOrientation="${config.game.orientation}"\n            android:theme="@android:style/Theme.NoTitleBar.Fullscreen"\n            android:configChanges="orientation|keyboardHidden|screenSize|screenLayout"\n            android:exported="true"\n            android:launchMode="singleTask"\n            tools:replace="android:exported">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>`;
    const existingPattern = /[ \t]*<!-- glory-game-managed:v1 -->\s*<activity\b[^>]*android:name="com\.glory\.adsdk\.launch\.GloryAdLaunchActivity"[\s\S]*?<\/activity>/;
    const legacyPattern = /[ \t]*<activity\b[^>]*android:name="com\.glory\.adsdk\.launch\.GloryAdLaunchActivity"[\s\S]*?<\/activity>/;
    if (output.includes('com.glory.adsdk.launch.GloryAdLaunchActivity')) {
        output = output.replace(existingPattern.test(output) ? existingPattern : legacyPattern, launchActivity);
    } else {
        output = output.replace(/([ \t]*<activity\b[^>]*android:name="com\.cocos\.lib\.CocosEditBoxActivity")/, `${launchActivity}\n\n$1`);
    }
    return output;
}

function transformRootBuildGradle(content, config) {
    if (!/com\.android\.tools\.build:gradle:[^'"\s]+/.test(content) || !/allprojects\s*\{[\s\S]*?repositories\s*\{/.test(content)) {
        throw new CliError('native build.gradle 不是可识别的 Cocos 模板，停止自动修改');
    }
    let output = content.replace(/com\.android\.tools\.build:gradle:[^'"\s]+/, `com.android.tools.build:gradle:${config.android.agpVersion}`);
    const additions = [];
    if (!output.includes('https://jitpack.io')) additions.push("        maven { url 'https://jitpack.io' }");
    if (!output.includes('https://maven.ms-mob.com/repository/maven-public/')) additions.push("        maven { url 'https://maven.ms-mob.com/repository/maven-public/' }");
    if (!/flatDir\s*\{[\s\S]*?dirs\s+['"]libs['"]/.test(output)) additions.push("        flatDir { dirs 'libs' }");
    if (additions.length) {
        output = output.replace(/(allprojects\s*\{\s*repositories\s*\{)/, `$1\n${additions.join('\n')}`);
    }
    return output;
}

function transformAppBuildGradle(content, config) {
    if (!content.includes("apply plugin: 'com.android.application'") || !content.includes("implementation project(':libcocos')")) {
        throw new CliError('app/build.gradle 不是可识别的 Cocos 3.8 模板，停止自动修改');
    }
    let output = content;
    if (!output.includes('gloryGameCenterAppSecret')) {
        output = output.replace(
            "apply plugin: 'com.android.application'",
            `apply plugin: 'com.android.application'\n\n// glory-game-managed:v1\ndef gloryGameCenterAppSecret = project.findProperty('GLORY_GAME_CENTER_APP_SECRET') ?: ''`,
        );
    }
    if (/^\s*ndkVersion\s+.+$/m.test(output)) {
        output = output.replace(/^\s*ndkVersion\s+.+$/m, `    ndkVersion "${escapeGroovySingle(config.android.ndkVersion)}"`);
    } else {
        output = output.replace(/^(\s*ndkPath\s+.+)$/m, `$1\n    ndkVersion "${escapeGroovySingle(config.android.ndkVersion)}"`);
    }
    output = output.replace(/^\s*versionCode\s+.+$/m, `        versionCode ${config.game.versionCode}`);
    output = output.replace(/^\s*versionName\s+.+$/m, `        versionName "${escapeGroovySingle(config.game.versionName)}"`);
    if (!output.includes('multiDexEnabled true')) {
        output = output.replace(/^(\s*versionName\s+.+)$/m, `$1\n        multiDexEnabled true\n        multiDexKeepProguard file('maindexlist.pro')`);
    }
    if (!output.includes('GLORY_GAME_CENTER_APP_SECRET')) {
        output = output.replace(/^(\s*multiDexKeepProguard\s+.+)$/m, `$1\n        buildConfigField 'String', 'GLORY_GAME_CENTER_APP_SECRET', '\"' + gloryGameCenterAppSecret + '\"'`);
    } else if (!output.includes("buildConfigField 'String', 'GLORY_GAME_CENTER_APP_SECRET'")) {
        output = output.replace(/^(\s*multiDexKeepProguard\s+.+)$/m, `$1\n        buildConfigField 'String', 'GLORY_GAME_CENTER_APP_SECRET', '\"' + gloryGameCenterAppSecret + '\"'`);
    }
    if (!/buildFeatures\s*\{[\s\S]*?buildConfig\s+true/.test(output)) {
        output = output.replace(/android\s*\{/, 'android {\n    buildFeatures { buildConfig true }');
    }
    output = output.replace(/^\s*assets\.srcDir(?:s)?\s+.*$/m, `        assets.srcDirs = ['assets', "\${RES_PATH}/data"]`);
    output = output.replace(/^\s*implementation fileTree\(dir: '\.\.\/libs'.*$/m, "    implementation fileTree(dir: '../libs', include: ['*.jar'])");
    output = output.replace(/^\s*implementation fileTree\(dir: 'libs'.*$/m, "    implementation fileTree(dir: 'libs', include: ['*.jar'])");
    const dependencies = [
        "    implementation fileTree(dir: '../glory-adsdk/libs', include: ['*.aar'])",
        "    implementation project(':glory-adsdk')",
        "    implementation 'androidx.multidex:multidex:2.0.0'",
        "    implementation 'androidx.palette:palette:1.0.0'",
        "    implementation 'androidx.legacy:legacy-support-v4:1.0.0'",
        "    implementation 'android.arch.persistence:db-framework:1.1.1'",
    ].filter((line) => !output.includes(line.trim()));
    if (dependencies.length) {
        output = output.replace(/(\s+if \(Boolean\.parseBoolean\(PROP_ENABLE_INPUTSDK\)\))/, `\n${dependencies.join('\n')}\n$1`);
    }
    return output;
}

function transformAppActivity(content) {
    if (!content.includes('public class AppActivity extends CocosActivity')) {
        throw new CliError('AppActivity.java 不是可识别的 Cocos 模板，停止自动修改');
    }
    let output = content;
    if (!output.includes('android.view.KeyEvent')) {
        output = output.replace('import android.content.res.Configuration;', 'import android.content.res.Configuration;\nimport android.view.KeyEvent;');
    }
    if (!output.includes('com.glory.adsdk.AdSdk')) {
        output = output.replace('import com.cocos.service.SDKWrapper;', 'import com.glory.adsdk.AdSdk;\nimport com.cocos.service.SDKWrapper;');
    }
    if (!output.includes('AdSdk.onMainActivityReady(this);')) {
        output = output.replace('SDKWrapper.shared().init(this);', 'AdSdk.onMainActivityReady(this);\n        SDKWrapper.shared().init(this);');
    }
    if (!output.includes('AdSdk.onBackPressed(this);')) {
        const method = `    // glory-game-managed:v1\n    @Override\n    public boolean onKeyDown(int keyCode, KeyEvent event) {\n        if (keyCode == KeyEvent.KEYCODE_BACK) {\n            AdSdk.onBackPressed(this);\n            return true;\n        }\n        return super.onKeyDown(keyCode, event);\n    }\n\n`;
        output = output.replace(/(\s*@Override\s+protected void onResume\(\))/, `\n${method}$1`);
    }
    return output;
}

function transformProguardRules(content) {
    if (content.includes('# glory-game-managed:oppo-proguard-v1')) return content;
    const rules = `

# glory-game-managed:oppo-proguard-v1
# 与 AttackMonster feature/integrate_ad_sdk@044808a 对齐：保护 OPPO/GameCenter 反射字段（含 SDK_JAR_VERSION）
-keep class com.nearme.** { *; }
-dontwarn com.nearme.**
-keep class com.oplus.** { *; }
-dontwarn com.oplus.**
-keep class com.opos.** { *; }
-keep class com.heytap.msp.mobad.** { *; }
-keep class com.heytap.openid.** { *; }
-keep class com.heytap.** { *; }
-dontwarn com.heytap.**
-keeppackagenames com.heytap.nearx.tapplugin
-keep class com.glorious.** { *; }
-dontwarn com.glorious.**

-keepclassmembers class * {
    public static ** Observable(...);
}
-keep class rx.** { *; }
-dontwarn rx.**
-keep class io.reactivex.** { *; }
-dontwarn io.reactivex.**
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**
-keep class * implements retrofit2.Converter { *; }
-keep class * implements retrofit2.Converter$Factory { *; }
-keepattributes Signature,Exceptions,InnerClasses,EnclosingMethod,*Annotation*

-keep class * implements java.io.Serializable { *; }
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

-keep class XI.CA.XI.** { *; }
-keep class XI.K0.XI.** { *; }
-keep class XI.XI.K0.** { *; }
-keep class XI.xo.XI.XI.** { *; }
-keep class com.asus.msa.SupplementaryDID.** { *; }
-keep class com.asus.msa.sdid.** { *; }
-keep class com.bun.lib.** { *; }
-keep class com.bun.miitmdid.** { *; }
-keep class com.huawei.hms.ads.identifier.** { *; }
-keep class com.samsung.android.deviceidservice.** { *; }
-keep class com.zui.opendeviceidlibrary.** { *; }
-keep class org.json.** { *; }
-keep public class com.netease.nis.sdkwrapper.Utils { public <methods>; }
`;
    return `${content.trimEnd()}${rules}`;
}

function createMyApplication(config) {
    const providerAppId = escapeJava(config.sdk?.providerAppId || '');
    const skipPrivacyBeforeTime = escapeJava(config.privacy?.skipBeforeTime || '');
    const policyUrl = escapeJava(config.privacy?.policyUrl || '');
    return `// glory-game-managed:v1
package com.cocos.game;

import android.content.Context;

import androidx.multidex.MultiDex;
import androidx.multidex.MultiDexApplication;

import ${config.game.packageName}.BuildConfig;
import com.glory.adsdk.AdSdk;
import com.glory.adsdk.AdSdkConfig;

/*
 * 新游戏接入参数修改位置：
 * 1. OPPO GameCenter app_key：
 *    app/AndroidManifest.xml 中 android:name="app_key" 的 meta-data。
 * 2. 广告 Provider App ID：
 *    本文件中的 config.adProviderAppId。
 * 3. OPPO Supplier App ID：
 *    app/assets/supplierconfig.json 中 supplier.oppo.appid。
 * 4. 隐私协议地址和跳过时间：
 *    本文件中的 privacyConfig.privacyPolicyUrl 和 config.skipPrivacyBeforeTime。
 * 5. GameCenter Secret：
 *    环境变量 GLORY_GAME_CENTER_APP_SECRET，由 app/build.gradle 写入 BuildConfig，
 *    不要把 Secret 明文提交到本文件。
 */
public class MyApplication extends MultiDexApplication {

    @Override
    public void onCreate() {
        super.onCreate();

        AdSdkConfig config = new AdSdkConfig();
        config.appKey = BuildConfig.APPLICATION_ID;
        config.versionName = BuildConfig.VERSION_NAME;
        config.adProviderAppId = "${providerAppId}";
        config.mainGameActivityClass = AppActivity.class;
        config.debug = BuildConfig.DEBUG;
        config.gameCenterAppSecret = BuildConfig.GLORY_GAME_CENTER_APP_SECRET;
        config.skipPrivacyBeforeTime = "${skipPrivacyBeforeTime}";

        AdSdkConfig.PrivacyConfig privacyConfig = new AdSdkConfig.PrivacyConfig();
        privacyConfig.privacyPolicyUrl = "${policyUrl}";
        config.privacyConfig = privacyConfig;
        AdSdk.init(this, config);
    }

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);
    }
}
`;
}

function createCocosSettings(config) {
    const name = escapeGroovySingle(config.android?.projectName || config.game.name);
    return `// glory-game-managed:v1
include ':libcocos', ':libservice', ':app', ':glory-adsdk'
project(':libcocos').projectDir = new File(COCOS_ENGINE_PATH, 'cocos/platform/android/libcocos2dx')
project(':app').projectDir = new File(NATIVE_DIR, 'app')
project(':app').name = '${name}'
project(':glory-adsdk').projectDir = new File(NATIVE_DIR, 'glory-adsdk')
if (PROP_ENABLE_INSTANT_APP == "true" || PROP_ENABLE_INSTANT_APP == "yes") {
    include ':instantapp'
    project(':instantapp').projectDir = new File(NATIVE_DIR, 'instantapp')
}

rootProject.name = '${name}'
`;
}

function createSupplierConfig(config) {
    return `${JSON.stringify({
        supplier: {
            vivo: { appid: '' },
            xiaomi: { appid: '' },
            huawei: { appid: '' },
            oppo: { appid: String(config.sdk.supplierAppId) },
        },
    }, null, 2)}\n`;
}

function transformProjectGitignore(content) {
    const lines = content.split(/\r?\n/);
    let changed = false;
    const next = lines.map((line) => {
        if (/^\s*\/?native\/?\s*$/.test(line)) {
            changed = true;
            return '# native/ 由 glory-game 管理并纳入版本控制';
        }
        return line;
    });
    return changed ? next.join('\n') : content;
}

function addFileChange(changes, path, content, description) {
    const before = readText(path);
    if (before !== content) changes.push({ path, before, content, description });
}

function planCocosPortabilityChanges(project) {
    const changes = [];
    const imagerPath = join(project, 'settings', 'v2', 'packages', 'imager.json');
    if (!existsSync(imagerPath)) return changes;
    const imager = readJson(imagerPath, '图片压缩插件配置');
    const output = imager.outDir || '';
    const externalOutput = imager.isAutoStart === '1'
        && isAbsolute(output)
        && !resolve(output).startsWith(`${project}${sep}`);
    if (externalOutput) {
        const portable = { ...imager, outDir: '' };
        addFileChange(
            changes,
            imagerPath,
            `${JSON.stringify(portable, null, 2)}\n`,
            '将图片压缩缓存改为项目内 build/imageCache（保留自动压缩）',
        );
    }
    return changes;
}

function applyCocosPortability(project, dryRun) {
    const changes = planCocosPortabilityChanges(project);
    if (!changes.length) return null;
    console.log(`${dryRun ? '需要调整' : '调整'} Cocos 可移植配置：`);
    for (const change of changes) console.log(`  ${change.path} — ${change.description}`);
    if (dryRun) return null;
    const backupRoot = writeIntegrationChanges(project, changes);
    if (backupRoot) console.log(`原配置备份：${backupRoot}`);
    return backupRoot;
}

function planIntegrationChanges(project, config) {
    const nativeRoot = join(project, 'native', 'engine', 'android');
    if (!existsSync(join(nativeRoot, 'app'))) {
        throw new CliError(`尚无 Cocos Android 原生模板：${nativeRoot}\n请先执行 cocos-build，或使用 integrate 自动完成 bootstrap`);
    }
    const files = {
        gitignore: join(project, '.gitignore'),
        rootGradle: join(nativeRoot, 'build.gradle'),
        appGradle: join(nativeRoot, 'app', 'build.gradle'),
        manifest: join(nativeRoot, 'app', 'AndroidManifest.xml'),
        appActivity: join(nativeRoot, 'app', 'src', 'com', 'cocos', 'game', 'AppActivity.java'),
        application: join(nativeRoot, 'app', 'src', 'com', 'cocos', 'game', 'MyApplication.java'),
        proguard: join(nativeRoot, 'app', 'proguard-rules.pro'),
        supplier: join(nativeRoot, 'app', 'assets', 'supplierconfig.json'),
        settings: join(nativeRoot, 'cocos-settings.gradle'),
        mainDex: join(nativeRoot, 'app', 'maindexlist.pro'),
    };
    for (const path of [files.rootGradle, files.appGradle, files.manifest, files.appActivity, files.proguard]) {
        if (!existsSync(path)) throw new CliError(`原生模板缺少必要文件：${path}`);
    }
    const existingApplication = readText(files.application);
    if (existingApplication && !existingApplication.includes('com.glory.adsdk.AdSdk') && !existingApplication.includes('glory-game-managed:v1')) {
        throw new CliError(`已有自定义 MyApplication，无法安全覆盖：${files.application}`);
    }
    const existingSettings = readText(files.settings);
    if (existingSettings && !existingSettings.includes("project(':app')")) {
        throw new CliError(`已有无法识别的 cocos-settings.gradle，停止自动修改：${files.settings}`);
    }

    const changes = [];
    addFileChange(changes, files.gitignore, transformProjectGitignore(readText(files.gitignore)), '让 native/ 进入版本控制');
    addFileChange(changes, files.rootGradle, transformRootBuildGradle(readText(files.rootGradle), config), '配置 AGP 和 SDK Maven 仓库');
    addFileChange(changes, files.appGradle, transformAppBuildGradle(readText(files.appGradle), config), '配置版本、MultiDex、SDK 依赖和安全密钥注入');
    addFileChange(changes, files.manifest, transformManifest(readText(files.manifest), config), '配置 Application、游戏中心参数和 SDK Launcher');
    addFileChange(changes, files.appActivity, transformAppActivity(readText(files.appActivity)), '接入 SDK Activity 生命周期');
    addFileChange(changes, files.proguard, transformProguardRules(readText(files.proguard)), '补齐 OPPO/GameCenter/R8 混淆保护规则');
    addFileChange(changes, files.application, createMyApplication(config), '生成 MyApplication SDK 初始化');
    addFileChange(changes, files.supplier, createSupplierConfig(config), '生成 supplierconfig.json');
    addFileChange(changes, files.settings, createCocosSettings(config), '生成包含 glory-adsdk 的 Cocos 模块配置');
    addFileChange(changes, files.mainDex, '# glory-game-managed:v1\n-keep class com.cocos.game.MyApplication { *; }\n-keep class androidx.multidex.** { *; }\n', '生成 MultiDex 主 dex 保留规则');
    const sdkPath = resolve(project, config.sdk.submodulePath);
    if (sdkPath === project || !sdkPath.startsWith(`${project}${sep}`)) {
        throw new CliError(`sdk.submodulePath 必须位于 Cocos 工程内部：${config.sdk.submodulePath}`);
    }
    return { nativeRoot, files, sdkPath, changes };
}

function printIntegrationChanges(plan, dryRun) {
    console.log(`${dryRun ? '接入预演' : '准备接入'}：${plan.changes.length} 个文件需要更新`);
    for (const change of plan.changes) {
        const action = change.before ? '修改' : '创建';
        console.log(`  ${action} ${change.path} — ${change.description}`);
    }
    console.log(`  ${existsSync(plan.sdkPath) ? '检查' : '添加'} ${plan.sdkPath} — glory-adsdk 子模块`);
}

function writeIntegrationChanges(project, changes) {
    const backupRoot = join(project, 'build', 'glory-cli', 'backups', timestamp());
    for (const change of changes) {
        if (change.before) {
            const backup = join(backupRoot, relative(project, change.path));
            mkdirSync(dirname(backup), { recursive: true });
            writeFileSync(backup, change.before, 'utf8');
        }
        mkdirSync(dirname(change.path), { recursive: true });
        writeFileSync(change.path, change.content, 'utf8');
    }
    return changes.some((change) => change.before) ? backupRoot : null;
}

function runGit(args, cwd, label) {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status !== 0) {
        throw new CliError(`${label}失败：${(result.stderr || result.stdout || '').trim()}`);
    }
    return (result.stdout || '').trim();
}

function ensureSdkSubmodule(project, config) {
    const repositoryRoot = gitRepositoryRoot(project);
    if (!repositoryRoot) throw new CliError('目标工程不在 Git 仓库中，无法添加 SDK 子模块');
    const sdkPath = resolve(project, config.sdk.submodulePath);
    if (sdkPath === project || !sdkPath.startsWith(`${project}${sep}`)) {
        throw new CliError(`sdk.submodulePath 必须位于 Cocos 工程内部：${config.sdk.submodulePath}`);
    }
    const repositoryRelativePath = relative(repositoryRoot, sdkPath);
    if (repositoryRelativePath.startsWith(`..${sep}`) || isAbsolute(repositoryRelativePath)) {
        throw new CliError(`SDK 路径不在 Git 仓库中：${sdkPath}`);
    }
    if (!existsSync(sdkPath)) {
        console.log(`添加 SDK 子模块：${config.sdk.submoduleUrl} -> ${repositoryRelativePath}`);
        runGit(['submodule', 'add', config.sdk.submoduleUrl, repositoryRelativePath], repositoryRoot, '添加 SDK 子模块');
    }
    const actualUrl = runGit(['config', '--get', 'remote.origin.url'], sdkPath, '读取 SDK remote');
    if (actualUrl !== config.sdk.submoduleUrl) {
        throw new CliError(`SDK remote 不一致：配置为 ${config.sdk.submoduleUrl}，实际为 ${actualUrl}`);
    }
    const expectedCommit = String(config.sdk.commit || '');
    if (!/^[0-9a-f]{40}$/i.test(expectedCommit)) {
        throw new CliError('sdk.commit 必须是完整的 40 位 Git commit，不能使用浮动分支');
    }
    const status = runGit(['status', '--porcelain'], sdkPath, '检查 SDK 工作区');
    if (status) throw new CliError(`SDK 子模块存在未提交修改，停止切换版本：\n${status}`);
    const actualCommit = runGit(['rev-parse', 'HEAD'], sdkPath, '读取 SDK commit');
    if (actualCommit !== expectedCommit) {
        const hasCommit = spawnSync('git', ['cat-file', '-e', `${expectedCommit}^{commit}`], { cwd: sdkPath }).status === 0;
        if (!hasCommit) runGit(['fetch', 'origin', expectedCommit], sdkPath, '获取指定 SDK commit');
        runGit(['checkout', '--detach', expectedCommit], sdkPath, '固定 SDK commit');
    }
    console.log(`SDK commit：${expectedCommit}`);
}

function requiredIntegrationFailures(inspection) {
    const requiredIds = [
        'source.native-tracked',
        'android.native-template',
        'glory.js-adapter',
        'glory.sdk-module',
        'glory.sdk-commit',
        'glory.manifest',
        'glory.app-gradle',
        'glory.app-activity',
        'glory.application',
        'glory.proguard',
        'glory.supplier-config',
        'glory.cocos-settings',
        'config.game-identity',
        'config.provider-app-id',
        'config.supplier-app-id',
        'config.game-center-app-key',
        'config.privacy',
    ];
    return inspection.checks.filter((check) => requiredIds.includes(check.id) && check.status !== 'pass');
}

function applyIntegration(project, config, options = {}) {
    validateApplyConfig(config);
    const plan = planIntegrationChanges(project, config);
    const dryRun = Boolean(options['dry-run']);
    printIntegrationChanges(plan, dryRun);
    if (dryRun) {
        console.log('\nDRY RUN：未写入文件、未添加或切换 SDK 子模块。');
        return { plan, inspection: inspectProject(project, config) };
    }
    const backupRoot = writeIntegrationChanges(project, plan.changes);
    if (!options['skip-submodule']) ensureSdkSubmodule(project, config);
    const inspection = inspectProject(project, config);
    const failures = requiredIntegrationFailures(inspection)
        .filter((check) => !(options['skip-submodule'] && check.id === 'glory.sdk-module'));
    if (backupRoot) console.log(`原文件备份：${backupRoot}`);
    if (failures.length) {
        throw new CliError(`接入文件已写入，但复检仍有 ${failures.length} 项未通过：\n- ${failures.map((item) => item.message).join('\n- ')}`);
    }
    console.log(`接入复检通过：${project}`);
    return { plan, inspection };
}

function selfTest(project, config) {
    validateApplyConfig(config);
    const creator = creatorExecutable(config.cocos.version, config);
    if (!creator.path) throw new CliError(`未找到 Cocos Creator ${config.cocos.version}`);
    const contents = dirname(dirname(creator.path));
    const templateRoot = join(contents, 'Resources', 'resources', '3d', 'engine', 'templates', 'android', 'template');
    const cases = [
        ['AndroidManifest.xml', join(templateRoot, 'app', 'AndroidManifest.xml'), (value) => transformManifest(value, config)],
        ['app/build.gradle', join(templateRoot, 'app', 'build.gradle'), (value) => transformAppBuildGradle(value, config)],
        ['build.gradle', join(templateRoot, 'build.gradle'), (value) => transformRootBuildGradle(value, config)],
        ['AppActivity.java', join(templateRoot, 'app', 'src', 'com', 'cocos', 'game', 'AppActivity.java'), transformAppActivity],
        ['proguard-rules.pro', join(templateRoot, 'app', 'proguard-rules.pro'), transformProguardRules],
    ];
    for (const [name, path, transform] of cases) {
        if (!existsSync(path)) throw new CliError(`Creator 模板缺少测试文件：${path}`);
        const first = transform(readText(path));
        const second = transform(first);
        if (first !== second) {
            let index = 0;
            while (index < first.length && index < second.length && first[index] === second[index]) index += 1;
            const firstContext = first.slice(Math.max(0, index - 80), index + 160).replace(/\n/g, '\\n');
            const secondContext = second.slice(Math.max(0, index - 80), index + 160).replace(/\n/g, '\\n');
            throw new CliError(`${name} 转换不幂等，差异位置 ${index}\n第一次：${firstContext}\n第二次：${secondContext}`);
        }
        if (name === 'AndroidManifest.xml' && existsSync('/usr/bin/xmllint')) {
            const xml = spawnSync('/usr/bin/xmllint', ['--noout', '-'], { input: first, encoding: 'utf8' });
            if (xml.status !== 0) throw new CliError(`AndroidManifest.xml 转换后不是有效 XML：${xml.stderr.trim()}`);
        }
        console.log(`✓ ${name} 模板识别与幂等测试通过`);
    }
    const inspection = inspectProject(project, config);
    if (!inspection.creator.path || !inspection.androidSdk || !inspection.java.path) {
        throw new CliError('环境自检未通过，无法完成 self-test');
    }
    console.log('✓ Creator、JDK、Android SDK 环境测试通过');
    const managedApplication = join(project, 'native', 'engine', 'android', 'app', 'src', 'com', 'cocos', 'game', 'MyApplication.java');
    if (inspection.nativeExists && readText(managedApplication).includes('glory-game-managed:v1')) {
        const plan = planIntegrationChanges(project, config);
        if (plan.changes.length) {
            throw new CliError(`已管理工程的幂等测试失败，仍有 ${plan.changes.length} 个文件变化`);
        }
        console.log('✓ 已管理 Android 工程重复 apply 为零文件变化');
    }
}

function xmlAttr(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function writeAndroidStudioVcsMappings(gradleProject, projectRoot, config) {
    const ideaDir = join(gradleProject, '.idea');
    mkdirSync(ideaDir, { recursive: true });
    const sdkRel = config.sdk?.submodulePath || 'native/engine/android/glory-adsdk';
    const sdkPath = join(projectRoot, sdkRel);
    const mappings = [
        '    <mapping directory="" vcs="Git" />',
        `    <mapping directory="${xmlAttr(projectRoot)}" vcs="Git" />`,
    ];
    if (existsSync(sdkPath)) {
        mappings.push(`    <mapping directory="${xmlAttr(sdkPath)}" vcs="Git" />`);
    }
    writeFileSync(
        join(ideaDir, 'vcs.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="VcsDirectoryMappings">
${mappings.join('\n')}
  </component>
</project>
`,
        'utf8',
    );
}

function applyGloryConfigToGeneratedProject(gradleProject, config, projectRoot, javaHome) {
    const settings = join(gradleProject, 'settings.gradle');
    const rootBuild = join(gradleProject, 'build.gradle');
    const wrapper = join(gradleProject, 'gradle', 'wrapper', 'gradle-wrapper.properties');
    const properties = join(gradleProject, 'gradle.properties');
    if (!existsSync(settings) || !existsSync(rootBuild) || !existsSync(wrapper) || !existsSync(properties)) {
        throw new CliError(`生成工程缺少 Gradle 文件：${gradleProject}`);
    }
    writeFileSync(settings, "apply from: new File(NATIVE_DIR, 'cocos-settings.gradle')\n", 'utf8');
    writeFileSync(
        rootBuild,
        replaceRequired(readText(rootBuild), /com\.android\.tools\.build:gradle:[^']+/, `com.android.tools.build:gradle:${config.android.agpVersion}`, 'Android Gradle Plugin 版本'),
        'utf8',
    );
    writeFileSync(
        wrapper,
        replaceRequired(readText(wrapper), /gradle-[0-9][^-]*-(?:bin|all)\.zip/, `gradle-${config.android.gradleVersion}-all.zip`, 'Gradle Wrapper 版本'),
        'utf8',
    );
    let nextProperties = readText(properties);
    nextProperties = setGradleProperty(nextProperties, 'android.useAndroidX', 'true');
    nextProperties = setGradleProperty(nextProperties, 'android.enableJetifier', 'true');
    if (config.android?.compileSdk) nextProperties = setGradleProperty(nextProperties, 'PROP_COMPILE_SDK_VERSION', config.android.compileSdk);
    if (config.android?.targetSdk) nextProperties = setGradleProperty(nextProperties, 'PROP_TARGET_SDK_VERSION', config.android.targetSdk);
    if (config.android?.buildToolsVersion) nextProperties = setGradleProperty(nextProperties, 'PROP_BUILD_TOOLS_VERSION', config.android.buildToolsVersion);
    const androidSdk = resolveAndroidSdk(projectRoot, config, gradleProject);
    const requiredNdk = sdkComponentPath(androidSdk, 'ndk', config.android?.ndkVersion);
    if (!requiredNdk || !existsSync(requiredNdk)) {
        throw new CliError(`未找到 Android NDK ${config.android?.ndkVersion}。请用 SDK Manager 安装到：${requiredNdk || '(未找到 Android SDK)'}`);
    }
    nextProperties = setGradleProperty(nextProperties, 'PROP_NDK_PATH', requiredNdk);
    if (javaHome) nextProperties = setGradleProperty(nextProperties, 'org.gradle.java.home', javaHome);
    writeFileSync(properties, nextProperties, 'utf8');
    if (projectRoot) writeAndroidStudioVcsMappings(gradleProject, projectRoot, config);
    console.log(`已写入 glory-adsdk 模块，并固定 AGP ${config.android.agpVersion} / Gradle ${config.android.gradleVersion} / JDK ${config.android.javaVersion} / NDK ${config.android.ndkVersion} / Jetifier`);
}

function normalizeGeneratedGradle(project, gradleProject, config, javaHome, dryRun) {
    const rootBuild = join(gradleProject, 'build.gradle');
    const settings = join(gradleProject, 'settings.gradle');
    const wrapper = join(gradleProject, 'gradle', 'wrapper', 'gradle-wrapper.properties');
    const properties = join(gradleProject, 'gradle.properties');
    for (const path of [rootBuild, settings, wrapper, properties]) {
        if (!existsSync(path)) throw new CliError(`生成工程缺少必要文件：${path}`);
    }
    const agpVersion = config.android.agpVersion;
    const gradleVersion = config.android.gradleVersion;
    if (!agpVersion || !gradleVersion) throw new CliError('配置缺少 android.agpVersion 或 android.gradleVersion');

    const changes = [];
    const rootBefore = readText(rootBuild);
    const rootAfter = replaceRequired(
        rootBefore,
        /com\.android\.tools\.build:gradle:[^']+/,
        `com.android.tools.build:gradle:${agpVersion}`,
        'Android Gradle Plugin 版本',
    );
    if (rootAfter !== rootBefore) changes.push({ path: rootBuild, content: rootAfter, description: `AGP → ${agpVersion}` });

    const settingsBefore = readText(settings);
    const settingsApply = "apply from: new File(NATIVE_DIR, 'cocos-settings.gradle')\n";
    if (settingsBefore !== settingsApply) {
        if (!settingsBefore.includes("include ':libcocos'") || !settingsBefore.includes("project(':app')")) {
            throw new CliError(`无法识别 Creator 生成的 settings.gradle，停止自动修改：${settings}`);
        }
        changes.push({ path: settings, content: settingsApply, description: '启用 native cocos-settings.gradle（包含 glory-adsdk）' });
    }

    const wrapperBefore = readText(wrapper);
    const wrapperAfter = replaceRequired(
        wrapperBefore,
        /gradle-[0-9][^-]*-(?:bin|all)\.zip/,
        `gradle-${gradleVersion}-all.zip`,
        'Gradle Wrapper 版本',
    );
    if (wrapperAfter !== wrapperBefore) changes.push({ path: wrapper, content: wrapperAfter, description: `Gradle Wrapper → ${gradleVersion}` });

    const propertiesBefore = readText(properties);
    const androidSdk = resolveAndroidSdk(project, config, gradleProject);
    const requiredNdkPath = androidSdk ? join(androidSdk, 'ndk', String(config.android.ndkVersion)) : null;
    if (!requiredNdkPath || !existsSync(requiredNdkPath)) {
        throw new CliError(`未找到配置要求的 Android NDK ${config.android.ndkVersion}`);
    }
    let propertiesAfter = setGradleProperty(propertiesBefore, 'org.gradle.java.home', javaHome);
    propertiesAfter = setGradleProperty(propertiesAfter, 'android.useAndroidX', 'true');
    propertiesAfter = setGradleProperty(propertiesAfter, 'android.enableJetifier', 'true');
    propertiesAfter = setGradleProperty(propertiesAfter, 'PROP_COMPILE_SDK_VERSION', config.android.compileSdk);
    propertiesAfter = setGradleProperty(propertiesAfter, 'PROP_TARGET_SDK_VERSION', config.android.targetSdk);
    propertiesAfter = setGradleProperty(propertiesAfter, 'PROP_BUILD_TOOLS_VERSION', config.android.buildToolsVersion);
    propertiesAfter = setGradleProperty(propertiesAfter, 'PROP_NDK_PATH', requiredNdkPath);
    if (propertiesAfter !== propertiesBefore) changes.push({ path: properties, content: propertiesAfter, description: '固定 JDK/SDK/Build Tools' });

    if (!dryRun) {
        for (const change of changes) writeFileSync(change.path, change.content, 'utf8');
    }
    return changes;
}

async function cocosBuild(project, config, options) {
    applyCocosPortability(project, Boolean(options['dry-run']));
    await ensureProjectDependencies(project, Boolean(options['dry-run']));
    const inspection = inspectProject(project, config);
    assertRequiredToolchain(inspection, config, 'cocos-build');
    const mode = String(options.mode || 'debug');
    if (!['debug', 'release'].includes(mode)) throw new CliError('--mode 只能是 debug 或 release');
    const outputName = String(options['output-name'] || `android-${timestamp()}`);
    if (outputName.includes('/') || outputName.includes('\\') || outputName === '.' || outputName === '..') {
        throw new CliError('--output-name 只能是单个目录名称');
    }
    const toolchain = {
        sdkPath: inspection.androidSdk,
        ndkPath: sdkComponentPath(inspection.androidSdk, 'ndk', config.android?.ndkVersion),
        javaHome: inspection.java.path,
    };
    const { buildConfig, buildRoot, outputPath, startScene } = createCocosBuildConfig(project, config, mode, outputName, toolchain);
    const stateRoot = join(project, 'build', 'glory-cli');
    const configPath = join(stateRoot, 'configs', `${outputName}.json`);
    const logPath = join(stateRoot, 'logs', `${outputName}.log`);
    const transcriptPath = join(stateRoot, 'logs', `${outputName}.console.log`);
    const args = [
        '--project', project,
        '--build', `configPath=${configPath};stage=build;logDest=${logPath}`,
    ];
    console.log(`Creator：${inspection.creator.path}`);
    console.log(`JDK：${inspection.java.version}（${inspection.java.path}）`);
    console.log(`Android SDK：${inspection.androidSdk}`);
    console.log(`NDK：${config.android.ndkVersion}（${toolchain.ndkPath}）`);
    console.log(`模式：${mode}`);
    console.log(`输出：${outputPath}`);
    console.log(`启动场景：${startScene.path}（${startScene.reason}）`);
    if (startScene.reason !== 'glory-game.yaml') {
        console.warn('启动场景未写入 glory-game.yaml。对方电脑没有本机 Cocos profiles，请把这个路径提交进配置。');
    }
    console.log(`配置：${configPath}`);
    console.log(`控制台日志：${transcriptPath}`);
    console.log(`命令：${inspection.creator.path} ${args.map((arg) => JSON.stringify(arg)).join(' ')}\n`);
    if (options['dry-run']) {
        console.log(JSON.stringify(buildConfig, null, 2));
        console.log('\nDRY RUN：未创建配置、未启动 Creator、未修改工程。');
        return { outputPath, buildConfig, dryRun: true };
    }
    if (existsSync(outputPath)) {
        throw new CliError(`输出目录已存在，为避免覆盖已停止：${outputPath}`);
    }
    mkdirSync(dirname(configPath), { recursive: true });
    mkdirSync(dirname(logPath), { recursive: true });
    mkdirSync(buildRoot, { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(buildConfig, null, 2)}\n`, 'utf8');
    const timeoutMinutes = Number(options['timeout-minutes'] || config.cocos.timeoutMinutes || 30);
    const result = await runProcess(inspection.creator.path, args, {
        cwd: project,
        env: {
            ...process.env,
            JAVA_HOME: inspection.java.path || process.env.JAVA_HOME,
            ANDROID_SDK_ROOT: inspection.androidSdk || process.env.ANDROID_SDK_ROOT,
        },
        timeoutMs: timeoutMinutes * 60 * 1000,
        transcriptPath,
        quiet: !options.verbose,
    });
    if (result.timedOut) throw new CliError(`Creator 构建超过 ${timeoutMinutes} 分钟，已停止本次子进程`);
    if (result.code !== 36 && result.code !== 0) {
        throw new CliError(`Creator 构建失败，退出码 ${result.code ?? 'null'}，信号 ${result.signal || 'none'}。日志：${logPath}`);
    }
    const swallowedError = result.diagnosticTail.match(/Error: ENOENT:[^\r\n]*/);
    if (swallowedError) {
        throw new CliError(`Creator 报告成功，但插件发生文件错误：${swallowedError[0]}。控制台日志：${transcriptPath}`);
    }
    const verification = verifyCocosOutput(outputPath);
    const missing = verification.filter((item) => !item.exists);
    for (const item of verification) console.log(`${item.exists ? '✓' : '✗'} ${item.path}`);
    if (missing.length) throw new CliError(`Creator 已退出，但缺少 ${missing.length} 个必要产物。日志：${logPath}`);
    console.log(`\nCocos Android 工程生成成功：${outputPath}`);

    applyGloryConfigToGeneratedProject(join(outputPath, 'proj'), config, project, inspection.java.path);

    const imager = join(project, 'settings', 'v2', 'packages', 'imager.json');
    if (existsSync(imager)) {
        const imagerConfig = readJson(imager, '图片压缩插件配置');
        if (imagerConfig.isAutoStart === '1') {
            const cacheRoot = imagerConfig.outDir
                ? resolve(project, imagerConfig.outDir)
                : join(project, 'build', 'imageCache');
            const cachedImages = findFiles(cacheRoot, (path) => /\.(png|jpe?g)$/i.test(path));
            if (cachedImages.length === 0) {
                console.warn(`! 图片压缩插件已启动，但缓存目录没有图片，不能确认压缩完成：${cacheRoot}`);
            } else {
                console.log(`✓ 图片压缩缓存：${cachedImages.length} 张`);
            }
        }
    }
    return { outputPath, buildConfig, dryRun: false };
}

async function androidBuild(project, config, options) {
    const inspection = inspectProject(project, config);
    assertRequiredToolchain(inspection, config, 'android-build');
    const mode = String(options.mode || 'debug');
    if (!['debug', 'release'].includes(mode)) throw new CliError('--mode 只能是 debug 或 release');
    const signing = releaseSigning(project, config, mode, Boolean(options['dry-run']));
    if (!options.input) throw new CliError('android-build 必须通过 --input 指定 Cocos 输出目录');
    const input = resolve(project, String(options.input));
    const gradleProject = existsSync(join(input, 'proj', 'gradlew')) ? join(input, 'proj') : input;
    const gradlew = join(gradleProject, 'gradlew');
    if (!existsSync(gradlew)) throw new CliError(`缺少 Gradle Wrapper：${gradlew}`);
    const secretEnv = config.sdk?.gameCenterAppSecretEnv;
    const managedApplication = readText(join(project, 'native', 'engine', 'android', 'app', 'src', 'com', 'cocos', 'game', 'MyApplication.java'))
        .includes('BuildConfig.GLORY_GAME_CENTER_APP_SECRET');
    let gameCenterSecret = secretEnv ? process.env[secretEnv] : null;
    if (!gameCenterSecret && options.scaffold) gameCenterSecret = 'PENDING_CONFIGURATION';
    if (!options['dry-run'] && managedApplication && !gameCenterSecret) {
        throw new CliError(`缺少游戏中心密钥环境变量：${secretEnv || '(未配置)'}`);
    }
    if (gameCenterSecret && !/^[A-Za-z0-9._-]+$/.test(gameCenterSecret)) {
        throw new CliError(`游戏中心密钥环境变量 ${secretEnv} 含不支持的字符`);
    }
    const normalization = normalizeGeneratedGradle(project, gradleProject, config, inspection.java.path, Boolean(options['dry-run']));
    const task = mode === 'debug' ? 'assembleDebug' : 'assembleRelease';
    const transcriptPath = join(project, 'build', 'glory-cli', 'logs', `${basename(input)}-${task}.console.log`);
    console.log(`Gradle 工程：${gradleProject}`);
    console.log(`JDK：${inspection.java.path}`);
    console.log(`任务：${task}`);
    if (signing) console.log(`Release 签名：${signing.storeFile} (${signing.keyAlias})`);
    if (normalization.length) {
        console.log('工程版本固定：');
        for (const change of normalization) console.log(`  ${change.description} (${change.path})`);
    } else {
        console.log('工程版本固定：已符合配置');
    }
    console.log(`控制台日志：${transcriptPath}`);
    console.log(`命令：bash ${gradlew} ${task} --stacktrace\n`);
    if (options['dry-run']) {
        console.log('DRY RUN：仅展示版本固定计划，未写文件、未启动 Gradle。');
        return;
    }
    mkdirSync(dirname(transcriptPath), { recursive: true });
    const timeoutMinutes = Number(options['timeout-minutes'] || config.android.timeoutMinutes || 30);
    const result = await runProcess('bash', [gradlew, task, '--stacktrace'], {
        cwd: gradleProject,
        env: {
            ...process.env,
            JAVA_HOME: inspection.java.path,
            ANDROID_SDK_ROOT: inspection.androidSdk || process.env.ANDROID_SDK_ROOT,
            ...(gameCenterSecret ? { ORG_GRADLE_PROJECT_GLORY_GAME_CENTER_APP_SECRET: gameCenterSecret } : {}),
            ...(signing ? {
                ORG_GRADLE_PROJECT_RELEASE_STORE_FILE: signing.storeFile,
                ORG_GRADLE_PROJECT_RELEASE_STORE_PASSWORD: signing.storePassword,
                ORG_GRADLE_PROJECT_RELEASE_KEY_ALIAS: signing.keyAlias,
                ORG_GRADLE_PROJECT_RELEASE_KEY_PASSWORD: signing.keyPassword,
            } : {}),
        },
        timeoutMs: timeoutMinutes * 60 * 1000,
        transcriptPath,
        quiet: !options.verbose,
    });
    if (result.timedOut) throw new CliError(`Gradle 构建超过 ${timeoutMinutes} 分钟，已停止本次子进程`);
    if (result.code !== 0) throw new CliError(`Gradle ${task} 失败，退出码 ${result.code ?? 'null'}。日志：${transcriptPath}`);
    const apks = findFiles(
        join(gradleProject, 'build'),
        (path) => path.endsWith('.apk') && path.includes(`${join('outputs', 'apk')}/`) && path.toLowerCase().includes(mode),
    );
    if (apks.length === 0) throw new CliError(`Gradle 成功但未找到 ${mode} APK：${gradleProject}`);
    console.log('\nAPK：');
    for (const apk of apks) console.log(`✓ ${apk}`);
    console.log('');
    const reports = apks.map((apk) => verifyApk(apk, config, inspection.androidSdk));
    const failures = reports.flatMap((report) => report.checks).filter((check) => check.status === 'fail');
    if (failures.length) throw new CliError(`APK 构建成功，但 ${failures.length} 项验证失败`);
    return { apks, reports };
}

async function integrate(project, config, options) {
    const mode = String(options.mode || 'debug');
    if (!['debug', 'release'].includes(mode)) throw new CliError('--mode 只能是 debug 或 release');
    const scaffold = Boolean(options.scaffold);
    if (scaffold && mode !== 'debug') throw new CliError('--scaffold 只允许构建 debug，不能生成可发布的 release 包');
    const effectiveConfig = scaffold ? createScaffoldConfig(project, config) : config;
    validateApplyConfig(effectiveConfig);
    if (scaffold) {
        console.warn('! 临时接入模式：未填写的 SDK/隐私参数将写成 PENDING_CONFIGURATION。');
        console.warn('! 本次目标是验证 SDK 接入、Cocos 生成和 Android Debug 编译；APK 不能发布。\n');
    }
    const portabilityChanges = planCocosPortabilityChanges(project);
    const initialInspection = inspectProject(project, effectiveConfig);
    if (options['dry-run']) {
        console.log('完整接入预演：');
        if (portabilityChanges.length) console.log('  0. 修正绑定其他机器路径的 Cocos 插件配置');
        console.log(`  1. ${initialInspection.nativeExists ? '复用已有' : '调用 Creator 生成'} native/ Android 模板`);
        console.log('  2. 安全应用 Manifest、Gradle、Java、supplierconfig 和 Cocos settings');
        console.log('  3. 添加并固定 glory-adsdk 子模块 commit');
        console.log('  4. 重新调用 Creator 生成最终 Android 工程');
        console.log(`  5. Gradle 编译 ${mode} APK`);
        console.log('  6. 验证包名、版本、ABI、Launcher、assets 和签名');
        if (initialInspection.nativeExists) applyIntegration(project, effectiveConfig, { ...options, 'dry-run': true });
        console.log('\nDRY RUN：未修改工程、未运行 Creator/Gradle、未访问 SDK remote。');
        return;
    }
    applyCocosPortability(project, false);
    if (!initialInspection.nativeExists) {
        console.log('阶段 1/4：生成 Cocos Android 原生模板');
        await cocosBuild(project, effectiveConfig, { ...options, mode: 'debug', 'output-name': `glory-bootstrap-${timestamp()}` });
    }
    console.log('\n阶段 2/4：应用 glory-adsdk 宿主接入');
    applyIntegration(project, effectiveConfig, options);
    console.log('\n阶段 3/4：生成最终 Cocos Android 工程');
    const cocosResult = await cocosBuild(project, effectiveConfig, { ...options, mode, 'output-name': String(options['output-name'] || `glory-integrated-${mode}-${timestamp()}`) });
    console.log('\n阶段 4/4：编译并验证 APK');
    const result = await androidBuild(project, effectiveConfig, { ...options, mode, input: cocosResult.outputPath });
    if (scaffold) {
        console.warn('\n! 接入与 Debug 编译已完成，但后台/隐私参数仍是占位值，APK 不可发布。');
        console.warn('! 以后分批运行 glory-game configure，填完后再运行 glory-game integrate --mode debug。');
    }
    return result;
}

async function main() {
    const { command, options, positional } = parseArgs(process.argv.slice(2));
    if (command === 'help' || options.help || command === '--help' || command === '-h') {
        console.log(usage());
        return;
    }
    if (command === 'version' || options.version) {
        console.log(CLI_VERSION);
        return;
    }
    const project = resolveProject(options);
    if (command === 'use') {
        rememberProject(project);
        console.log(`当前项目已设置为：${project}`);
        return;
    }
    if (command === 'init-config') {
        await initConfig(project, options);
        return;
    }
    if (command === 'status') {
        const loaded = loadConfigUnchecked(project, options, true);
        printConfigStatus(project, loaded.path, loaded.value);
        return;
    }
    if (command === 'configure') {
        await configureProject(project, options, positional[0]);
        return;
    }
    if (command === 'inspect') {
        const config = loadConfig(project, options, false).value;
        printInspection(inspectProject(project, config), Boolean(options.json));
        return;
    }
    if (command === 'plan') {
        const config = loadConfig(project, options, true).value;
        const inspection = inspectProject(project, config);
        printPlan(buildPlan(project, config, inspection), Boolean(options.json));
        return;
    }
    if (command === 'apply') {
        const loadedConfig = loadConfig(project, options, true).value;
        const config = createScaffoldConfig(project, loadedConfig);
        if ([
            loadedConfig.sdk?.gameCenterAppKey,
            loadedConfig.sdk?.providerAppId,
            loadedConfig.sdk?.supplierAppId,
            loadedConfig.privacy?.policyUrl,
            loadedConfig.privacy?.skipBeforeTime,
        ].some(isMissingConfigValue)) {
            console.warn('广告、隐私参数未填，宿主先留空。以后改 MyApplication、Manifest 的 app_key、supplierconfig.json。');
        }
        applyIntegration(project, config, options);
        return;
    }
    if (command === 'cocos-build') {
        const config = loadConfig(project, options, true).value;
        await cocosBuild(project, config, options);
        return;
    }
    if (command === 'android-build') {
        const config = loadConfig(project, options, true).value;
        await androidBuild(project, config, options);
        return;
    }
    if (command === 'integrate') {
        const config = loadConfig(project, options, true).value;
        await integrate(project, config, options);
        return;
    }
    if (command === 'self-test') {
        const config = loadConfig(project, options, true).value;
        selfTest(project, config);
        return;
    }
    if (command === 'verify-apk') {
        const config = loadConfig(project, options, true).value;
        if (!options.apk) throw new CliError('verify-apk 必须通过 --apk 指定 APK');
        const inspection = inspectProject(project, config);
        const report = verifyApk(resolve(project, String(options.apk)), config, inspection.androidSdk, Boolean(options.json));
        if (report.checks.some((check) => check.status === 'fail')) process.exitCode = 3;
        return;
    }
    throw new CliError(`未知命令：${command}\n\n${usage()}`);
}

main().catch((error) => {
    console.error(`错误：${error.message}`);
    process.exitCode = error.exitCode || 1;
});
