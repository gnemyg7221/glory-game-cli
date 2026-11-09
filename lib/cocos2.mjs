import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGameIconPath, copyLauncherIcons } from './icons.mjs';

const MARK = 'glory-game-managed:v1';

export function isCreator2Version(version) {
    return String(version || '').startsWith('2.');
}

export function creator2BuildArgument(config, sceneUuid, encrypted) {
    const abis = config.cocos.appABIs.map((abi) => `'${abi}'`).join(',');
    const parts = [
        'platform=android',
        `debug=${encrypted ? 'false' : 'true'}`,
        'template=link',
        `buildPath=${config.cocos.buildRoot || 'build'}`,
        `title=${config.game.name}`,
        `packageName=${config.game.packageName}`,
        `startScene=${sceneUuid}`,
        `encryptJs=${encrypted ? 'true' : 'false'}`,
        'zipCompressJs=true',
        `apiLevel=android-${config.cocos.apiLevel}`,
        `appABIs=[${abis}]`,
        'md5Cache=false',
        'autoCompile=false',
        'useDebugKeystore=true',
    ];
    if (encrypted && config.cocos.xxteaKey) parts.push(`xxteaKey=${config.cocos.xxteaKey}`);
    return parts.join(';');
}

function readText(path) {
    return readFileSync(path, 'utf8');
}

function writeText(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function setProperty(content, name, value) {
    const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
    if (pattern.test(content)) return content.replace(pattern, `${name}=${value}`);
    return `${content.replace(/\s*$/, '')}\n${name}=${value}\n`;
}

function escapeXml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJava(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function creator2Output(project) {
    return join(project, 'build', 'jsb-link', 'frameworks', 'runtime-src', 'proj.android-studio');
}

function myApplicationSource(config, existing = '') {
    const appId = escapeJava(config.game.appId || '');
    const privacyValue = (value, pattern) => escapeJava(
        value != null && value !== '' && value !== 'REQUIRED' && value !== 'PENDING_CONFIGURATION'
            ? value : (existing.match(pattern)?.[1] || ''),
    );
    const policyUrl = privacyValue(config.privacy?.policyUrl, /privacyConfig\.privacyPolicyUrl\s*=\s*"([^"]*)"/);
    const skipBeforeTime = privacyValue(config.privacy?.skipBeforeTime, /config\.skipPrivacyBeforeTime\s*=\s*"([^"]*)"/);
    return `// ${MARK}
package org.cocos2dx.javascript;

import android.content.Context;

import androidx.multidex.MultiDex;
import androidx.multidex.MultiDexApplication;

import ${config.game.packageName}.BuildConfig;
import com.glory.adsdk.AdSdk;
import com.glory.adsdk.AdSdkConfig;

/*
 * appKey / appId / appSecret 只改 glory-game.yaml 的 game 段，然后重新 glory-game onboard。
 */
public class MyApplication extends MultiDexApplication {

    @Override
    public void onCreate() {
        super.onCreate();

        AdSdkConfig config = new AdSdkConfig();
        config.appKey = BuildConfig.APPLICATION_ID;
        config.versionName = BuildConfig.VERSION_NAME;
        config.adProviderAppId = "${appId}";
        config.mainGameActivityClass = AppActivity.class;
        config.debug = BuildConfig.DEBUG;
        config.gameCenterAppSecret = BuildConfig.GLORY_GAME_CENTER_APP_SECRET;
        config.skipPrivacyBeforeTime = "${skipBeforeTime}";

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

function jsbBridgeSource() {
    return `package com.cocos.lib;

import android.util.Log;

import org.cocos2dx.lib.Cocos2dxHelper;
import org.cocos2dx.lib.Cocos2dxJavascriptJavaBridge;
import org.json.JSONObject;

/** Creator 2.4 没有 com.cocos.lib.JsbBridge。给 glory-adsdk 的编译和回调用。 */
public class JsbBridge {
    public interface ICallback {
        void onScript(String arg0, String arg1);
    }

    private static ICallback callback;

    public static void setCallback(ICallback value) {
        callback = value;
    }

    public static void dispatch(String arg0, String arg1) {
        if (callback != null) callback.onScript(arg0, arg1);
    }

    public static void sendToScript(final String arg0, final String arg1) {
        final String script = "if (window.jsCallback) { window.jsCallback("
                + JSONObject.quote(arg0 == null ? "" : arg0) + ","
                + JSONObject.quote(arg1 == null ? "" : arg1) + "); }";
        try {
            Cocos2dxHelper.runOnGLThread(new Runnable() {
                @Override
                public void run() {
                    Cocos2dxJavascriptJavaBridge.evalString(script);
                }
            });
        } catch (Throwable error) {
            Log.e("JsbBridge", "sendToScript failed", error);
        }
    }
}
`;
}

function hybridBridgeSource() {
    return `package com.cocos.game.hybrid;

/** Creator 2.4 的 JS 通过 jsb.reflection 调这个类。 */
public class JsBridgeManager {
    public static void sendToJava(String type, String data) {
        com.cocos.lib.JsbBridge.dispatch(type, data);
    }
}
`;
}

function stubGradle() {
    return `apply plugin: 'com.android.library'

android {
    namespace "com.cocos.lib"
    compileSdkVersion 30

    defaultConfig {
        minSdkVersion 21
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    compileOnly project(':libcocos2dx')
}
`;
}

function patchManifest(content, config) {
    let output = content;
    if (!output.includes('xmlns:tools=')) {
        output = output.replace('<manifest', '<manifest xmlns:tools="http://schemas.android.com/tools"');
    }
    if (!output.includes('com.gcsdk.msp.duidprovider')) {
        const queries = `    <queries>
        <provider android:authorities="com.gcsdk.msp.duidprovider" tools:replace="android:authorities" />
        <provider android:authorities="com.oplus.statistics.provider" tools:replace="android:authorities" />
    </queries>

`;
        output = output.replace(/(\s*<application\b)/, `\n${queries}$1`);
    }
    if (!output.includes('android.permission.VIBRATE')) {
        output = output.replace(/(\s*<application\b)/, '\n    <uses-permission android:name="android.permission.VIBRATE" />\n$1');
    }
    output = output.replace(/<application\b[^>]*>/, (tag) => {
        tag = tag.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
        if (/android:name=/.test(tag)) return tag.replace(/android:name="[^"]*"/, 'android:name="org.cocos2dx.javascript.MyApplication"');
        return tag.replace('<application', '<application\n        android:name="org.cocos2dx.javascript.MyApplication"');
    });
    const appKey = config.game.appKey || '';
    if (appKey) {
        const tag = `<meta-data android:name="app_key" android:value="${escapeXml(appKey)}" />`;
        if (output.includes('android:name="app_key"')) {
            output = output.replace(/<meta-data\s+android:name="app_key"[^>]*\/>/, tag);
        } else {
            output = output.replace(/(<application\b[^>]*>)/, `$1\n        ${tag}`);
        }
    }
    output = output.replace(/(<activity\b[^>]*android:name="org\.cocos2dx\.javascript\.AppActivity"[^>]*>)/, (tag) => (
        tag.includes('screenOrientation=')
            ? tag.replace(/android:screenOrientation="[^"]*"/, `android:screenOrientation="${config.game.orientation}"`)
            : tag
    ));
    output = output.replace(
        /(<activity\b[^>]*android:name="org\.cocos2dx\.javascript\.AppActivity"[\s\S]*?<\/activity>)/,
        (block) => block.replace(/\s*<intent-filter>[\s\S]*?android\.intent\.category\.LAUNCHER[\s\S]*?<\/intent-filter>/, ''),
    );
    output = output.replace(new RegExp(`[ \\t]*<!-- ${MARK} -->\\s*<activity\\b[^>]*android:name="com\\.glory\\.adsdk\\.launch\\.GloryAdLaunchActivity"[\\s\\S]*?</activity>\\n*`, 'g'), '');
    const launch = `        <!-- ${MARK} -->
        <activity
            android:name="com.glory.adsdk.launch.GloryAdLaunchActivity"
            android:label="@string/app_name"
            android:screenOrientation="${config.game.orientation}"
            android:theme="@android:style/Theme.NoTitleBar.Fullscreen"
            android:configChanges="orientation|keyboardHidden|screenSize|screenLayout"
            android:exported="true"
            tools:replace="android:exported"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>`;
    output = output.replace(/[ \t]*(<activity\b[^>]*android:name="org\.cocos2dx\.javascript\.AppActivity")/, `${launch}\n\n        $1`);
    return output;
}

function patchAppGradle(content, config) {
    let output = content;
    if (!output.includes('gloryGameCenterAppSecret')) {
        output = output.replace(
            "apply plugin: 'com.android.application'",
            `apply plugin: 'com.android.application'\n\n// ${MARK}\ndef gloryGameCenterAppSecret = project.findProperty('GLORY_GAME_CENTER_APP_SECRET') ?: ''`,
        );
    }
    if (!/\bnamespace\s+/.test(output)) output = output.replace(/android\s*\{/, `android {\n    namespace "${config.game.packageName}"`);
    output = output.replace(/namespace\s+"[^"]*"/, `namespace "${config.game.packageName}"`);
    output = output.replace(/applicationId\s+"[^"]*"/, `applicationId "${config.game.packageName}"`);
    output = output.replace(/versionCode\s+\d+/, `versionCode ${config.game.versionCode}`);
    output = output.replace(/versionName\s+"[^"]*"/, `versionName "${config.game.versionName}"`);
    if (!/buildFeatures\s*\{[\s\S]*?buildConfig\s+true/.test(output)) {
        output = output.replace(/android\s*\{/, 'android {\n    buildFeatures { buildConfig true }');
    }
    if (!output.includes("buildConfigField 'String', 'GLORY_GAME_CENTER_APP_SECRET'")) {
        output = output.replace(
            /(versionName\s+"[^"]*")/,
            `$1\n        buildConfigField 'String', 'GLORY_GAME_CENTER_APP_SECRET', '"' + gloryGameCenterAppSecret + '"'`,
        );
    }
    const deps = [
        "    implementation project(':glory-adsdk')",
        "    implementation project(':libcocos')",
        "    implementation fileTree(dir: new File(project(':glory-adsdk').projectDir, 'libs'), include: ['*.aar'])",
        "    implementation 'androidx.multidex:multidex:2.0.0'",
        "    implementation 'androidx.palette:palette:1.0.0'",
        "    implementation 'androidx.legacy:legacy-support-v4:1.0.0'",
        "    implementation 'android.arch.persistence:db-framework:1.1.1'",
    ];
    for (const line of deps) {
        if (!output.includes(line.trim())) {
            output = output.replace(/(implementation project\(':libcocos2dx'\))/, `$1\n${line}`);
        }
    }
    if (!output.includes('assets.srcDirs')) {
        output = output.replace(/(manifest\.srcFile\s+"AndroidManifest.xml")/, "$1\n        assets.srcDirs = ['assets']");
    }
    // Studio edits the Git-tracked host instead of disposable build copies.
    const trackedJava = 'java.setSrcDirs(["../src", new File(rootDir, "../../../../../build-templates/jsb-link/frameworks/runtime-src/proj.android-studio/app/src")])';
    output = output.replace(/java\.srcDirs[^\r\n]+/, trackedJava);
    // Older Creator templates execute this deletion during Gradle configuration.
    // Remove the instruction, preserving files already on disk.
    output = output.replace(/^\s*\/\/ delete previous files first\r?\n/gm, '\n')
        .replace(/^\s*delete "\$\{buildDir\}\/intermediates\/merged_assets\/\$\{variant.dirName\}"\r?\n/gm, '\n');
    if (!output.includes('glory-game-managed:creator2-assets-inputs')) {
        const anchor = /variant\.mergeAssets\.doLast\s*\{/;
        if (!anchor.test(output)) throw new Error('无法识别 Creator 2.4 mergeAssets 任务，停止修改。');
        output = output.replace(anchor, `// glory-game-managed:creator2-assets-inputs
    variant.mergeAssets.inputs.files(fileTree(dir: "\u0024{buildDir}/../../../../..", includes: [
        'assets/**', 'src/**', 'jsb-adapter/**', 'main.js', 'project.json'
    ]))
    variant.mergeAssets.doLast {`);
    }
    return output;
}

function patchAppActivity(content) {
    if (!/extends\s+Cocos2dxActivity/.test(content)) throw new Error('AppActivity 不是 Creator 2.4 模板，停止修改。');
    let output = content;
    for (const name of ['android.view.KeyEvent', 'com.glory.adsdk.AdSdk']) {
        if (!output.includes(`import ${name};`)) output = output.replace(/(package [^;]+;)/, `$1\n\nimport ${name};`);
    }
    if (!output.includes('AdSdk.onMainActivityReady(this);')) {
        if (!/super\.onCreate\(savedInstanceState\);/.test(output)) throw new Error('缺少 onCreate 初始化位置，停止修改。');
        output = output.replace('super.onCreate(savedInstanceState);', 'super.onCreate(savedInstanceState);\n        AdSdk.onMainActivityReady(this);');
    }
    if (!output.includes('AdSdk.onBackPressed(this);')) {
        if (/boolean\s+onKeyDown\s*\(/.test(output)) throw new Error('已有自定义 onKeyDown，请核对 SDK 返回键接入。');
        output = output.replace(/(public class AppActivity extends Cocos2dxActivity\s*\{)/, `$1
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            AdSdk.onBackPressed(this);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
`);
    }
    return output;
}

function patchRootGradle(content) {
    if (content.includes(MARK)) return content;
    return `${content.replace(/\s*$/, '')}

// ${MARK}
subprojects { sub ->
    sub.plugins.withId('com.android.library') {
        if (sub.name == 'glory-adsdk') {
            sub.android.namespace = 'com.glory.adsdk'
        }
    }
}
`;
}

function patchSettings(content, proj, project, config) {
    const stub = relative(proj, join(project, 'native', 'cocos2-jsb')).split('\\').join('/');
    const sdk = relative(proj, join(project, config.sdk?.submodulePath || 'native/engine/android/glory-adsdk')).split('\\').join('/');
    const block = `
// ${MARK}
include ':libcocos'
project(':libcocos').projectDir = new File(settingsDir, '${stub}')
include ':glory-adsdk'
project(':glory-adsdk').projectDir = new File(settingsDir, '${sdk}')
`;
    const stripped = content.replace(new RegExp(`\\n// ${MARK}[\\s\\S]*$`), '');
    return `${stripped.replace(/\s*$/, '')}\n${block}`;
}

function patchStrings(content, name) {
    if (content.includes(`>${escapeXml(name)}<`)) return content;
    if (content.includes('name="app_name"')) {
        return content.replace(/(<string\s+name="app_name"[^>]*>)[\s\S]*?(<\/string>)/, `$1${escapeXml(name)}$2`);
    }
    return content;
}

export function applyCreator2Host(project, proj, config, javaHome) {
    if (!existsSync(join(proj, 'settings.gradle')) || !existsSync(join(proj, 'app', 'build.gradle'))) {
        throw new Error('Creator 2.4 还没有导出 Android 工程：' + proj);
    }
    const activity = join(proj, 'app/src/org/cocos2dx/javascript/AppActivity.java');
    // Validate custom activity code before writing any host files.
    const trackedActivity = join(project, 'build-templates/jsb-link/frameworks/runtime-src/proj.android-studio/app/src/org/cocos2dx/javascript/AppActivity.java');
    const patchedActivity = patchAppActivity(readText(existsSync(trackedActivity) ? trackedActivity : activity));
    const patchedGradle = patchAppGradle(readText(join(proj, 'app/build.gradle')), config);
    resolveGameIconPath(project, config);
    const backupRoot = join(project, 'build/glory-cli/backups', 'cli-host-' + Date.now() + '-' + process.hrtime.bigint());
    const writeText = (path, content) => {
        const text = content.endsWith('\n') ? content : content + '\n';
        if (existsSync(path)) {
            if (readText(path) === text) return;
            const backup = join(backupRoot, relative(project, path));
            mkdirSync(dirname(backup), { recursive: true });
            copyFileSync(path, backup);
        }
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text, 'utf8');
    };
    const stubRoot = join(project, 'native', 'cocos2-jsb');
    writeText(join(stubRoot, 'build.gradle'), stubGradle());
    writeText(join(stubRoot, 'src/main/AndroidManifest.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<manifest />\n');
    writeText(join(stubRoot, 'src/main/java/com/cocos/lib/JsbBridge.java'), jsbBridgeSource());
    writeText(join(stubRoot, 'src/main/java/com/cocos/game/hybrid/JsBridgeManager.java'), hybridBridgeSource());

    const applicationPath = join(proj, 'app', 'src', 'org', 'cocos2dx', 'javascript', 'MyApplication.java');
    const templateRoot = join(project, 'build-templates/jsb-link/frameworks/runtime-src/proj.android-studio');
    const applicationTemplate = join(templateRoot, 'app/src/org/cocos2dx/javascript/MyApplication.java');
    const existingApplication = existsSync(applicationTemplate) ? readText(applicationTemplate)
        : existsSync(applicationPath) ? readText(applicationPath) : '';
    const application = myApplicationSource(config, existingApplication);
    writeText(applicationPath, application);
    writeText(join(
        project,
        'build-templates',
        'jsb-link',
        'frameworks',
        'runtime-src',
        'proj.android-studio',
        'app',
        'src',
        'org',
        'cocos2dx',
        'javascript',
        'MyApplication.java',
    ), application);

    const manifestPath = join(proj, 'app', 'AndroidManifest.xml');
    writeText(manifestPath, patchManifest(readText(manifestPath), config));
    writeText(join(proj, 'app', 'build.gradle'), patchedGradle);
    writeText(join(proj, 'build.gradle'), patchRootGradle(readText(join(proj, 'build.gradle'))));
    writeText(join(proj, 'settings.gradle'), patchSettings(readText(join(proj, 'settings.gradle')), proj, project, config));
    writeText(activity, patchedActivity);

    const rootBuild = join(proj, 'build.gradle');
    writeText(rootBuild, readText(rootBuild).replace(/com\.android\.tools\.build:gradle:[^'"\s]+/, `com.android.tools.build:gradle:${config.android.agpVersion || '8.0.2'}`));
    const wrapper = join(proj, 'gradle/wrapper/gradle-wrapper.properties');
    if (existsSync(wrapper)) writeText(wrapper, readText(wrapper).replace(/gradle-[0-9][^-]*-(bin|all)\.zip/, `gradle-${config.android.gradleVersion || '8.0.2'}-$1.zip`));

    let properties = readText(join(proj, 'gradle.properties'));
    for (const [name, value] of [
        ['PROP_COMPILE_SDK_VERSION', String(config.android.compileSdk)],
        ['PROP_MIN_SDK_VERSION', '21'],
        ['PROP_TARGET_SDK_VERSION', String(config.android.targetSdk)],
        ['PROP_BUILD_TOOLS_VERSION', config.android.buildToolsVersion],
        ['PROP_APP_ABI', config.cocos.appABIs.join(':')],
        ['android.useAndroidX', 'true'],
        ['android.enableJetifier', 'true'],
        ['org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8'],
        ['org.gradle.workers.max', '4'],
        ['GLORY_GAME_CENTER_APP_SECRET', config.game.appSecret || ''],
    ]) properties = setProperty(properties, name, value);
    if (javaHome) properties = setProperty(properties, 'org.gradle.java.home', javaHome);
    writeText(join(proj, 'gradle.properties'), properties);

    const stringsPath = join(proj, 'res', 'values', 'strings.xml');
    if (existsSync(stringsPath)) writeText(stringsPath, patchStrings(readText(stringsPath), config.game.name));

    const supplierPath = join(proj, 'app', 'assets', 'supplierconfig.json');
    const supplierTemplate = join(templateRoot, 'app/assets/supplierconfig.json');
    const supplierConfig = existsSync(supplierPath) ? JSON.parse(readText(supplierPath))
        : existsSync(supplierTemplate) ? JSON.parse(readText(supplierTemplate)) : {};
    supplierConfig.supplier ||= {};
    for (const vendor of ['vivo', 'xiaomi', 'huawei', 'oppo']) {
        supplierConfig.supplier[vendor] ||= { appid: '' };
    }
    supplierConfig.supplier.oppo.appid = String(config.game.appId || '');
    writeText(supplierPath, JSON.stringify(supplierConfig, null, 2));

    const proguardPath = join(proj, 'app', 'proguard-rules.pro');
    if (existsSync(proguardPath)) {
        const before = readText(proguardPath);
        if (!before.includes('com.cocos.game.hybrid.JsBridgeManager')) {
            writeText(proguardPath, `${before.replace(/\s*$/, '')}

# ${MARK}
-keep class com.cocos.game.hybrid.JsBridgeManager { *; }
-keep class com.cocos.lib.JsbBridge { *; }
-keep class com.glory.adsdk.** { *; }
`);
        }
    }
    const r8 = readText(proguardPath);
    const rulesPath = fileURLToPath(new URL('../templates/creator2-sdk-r8.pro', import.meta.url));
    const rules = readText(rulesPath);
    const missingRules = rules.split('\n').filter((line) => line.startsWith('-') && !r8.split(/\r?\n/).includes(line));
    if (missingRules.length) writeText(proguardPath, `${r8.trimEnd()}\n\n# glory-game-managed:creator2-sdk-r8\n${missingRules.join('\n')}\n`);

    // Persist portable host fixes so an ordinary Creator export keeps them.
    for (const name of ['app/AndroidManifest.xml', 'app/build.gradle', 'app/proguard-rules.pro',
        'app/src/org/cocos2dx/javascript/AppActivity.java', 'app/assets/supplierconfig.json',
        'build.gradle', 'settings.gradle', 'gradle/wrapper/gradle-wrapper.properties']) {
        const path = join(proj, name);
        if (existsSync(path)) writeText(join(templateRoot, name), readText(path));
    }
    writeText(join(templateRoot, 'gradle.properties'), properties.replace(/^org\.gradle\.java\.home=.*\r?\n?/gm, ''));
    copyLauncherIcons(project, config, [join(proj, 'res'), join(templateRoot, 'res')]);

    const runtimePath = join(project, 'build/jsb-link/project.json');
    if (existsSync(runtimePath)) {
        const runtime = JSON.parse(readText(runtimePath));
        if (!Object.hasOwn(runtime, 'serviceClassPath')) {
            runtime.serviceClassPath = [];
            writeText(runtimePath, JSON.stringify(runtime, null, 2));
        }
    }
}

export function prepareCreator2Settings(project, config) {
    const builderPath = join(project, 'settings', 'builder.json');
    if (!existsSync(builderPath)) return;
    const builder = JSON.parse(readText(builderPath));
    builder.title = config.game.name;
    builder.android = { ...(builder.android || {}), packageName: config.game.packageName };
    builder.packageName = config.game.packageName;
    if (config.cocos.xxteaKey) builder.xxteaKey = config.cocos.xxteaKey;
    writeText(builderPath, `${JSON.stringify(builder, null, 2)}\n`);
}
