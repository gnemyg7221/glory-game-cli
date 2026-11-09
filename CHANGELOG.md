# 版本变更

版本号以 `package.json` 为准。`glory-game version` 读的是同一个号。

别人已经 `npm link` 过的，拉最新后在 CLI 仓库根目录执行：

```bash
git pull
npm install
glory-game version
```

一般不用再 `npm link`。依赖或 `bin` 变了才需要再 link 一次。

---

## 0.11.6 - 2026-11-09

- 修复 Creator 2.4 的 OAID 配置生成：保留既有厂商配置，补齐 vivo / xiaomi / huawei / oppo 结构，不再仅生成 oppo。原精简结构会导致 1.0.25 OAID SDK 加载配置失败；真机修复后确认获取成功。

- 修复游戏桌面图标仍为 Cocos 默认图的问题：init-config / onboard 优先识别工程已有的 other/logo、logo 等品牌 PNG，不再无条件写入不存在的默认路径；onboard 可迁移旧的无效默认路径，并将实际选择写回 yaml。
- 配置缺失、路径不存在、非 PNG 或非正方形图标明确报错；doctor 检查源图和 Android 资源一致性。
- Creator 2.4 接入、sync 及重新导出时同步 launcher 图标到生成工程与 build-templates；3.8 使用 native/res，避免向同一 sourceSet 写入重复资源。
- 替换旧图前备份，重复同步无变化时不重写；补齐图标预演、重入、模板及错误路径回归检查。

---

## 0.11.5 - 2026-11-08

- Creator 2.4 自动准备 Java 17、Studio 本机 JDK、Gradle 4 GB 堆及 NDK 21 兼容入口；Apple 芯片检测 Rosetta，目录含空格时使用工程路径别名。保留原 NDK 和修改前备份，不清理缓存。
- 补齐 AppActivity 的 SDK 桥接与返回键、SQLite 等运行依赖、Manifest 合并策略、AGP 8 精确外部类规则。保留 Release 混淆和资源压缩。
- 2.4 宿主及修复持久化到 build-templates；隐私配置可由 yaml 更新，yaml 未填写时保留宿主已有值。cocos-build 重新导出后自动恢复接入及本机环境；sync、open-studio、android-build、onboard --with-apk 使用 2.4 工程路径。
- 2.4 资源复制显式声明 Gradle 输入，修复导出新脚本后仍打入旧资源的问题。
- 新增只读 doctor：复用环境和接入检查，并定位 2.4 资源包大小写及裸 js-base64 引用；不修改游戏业务源码。
- 新增 smoke-test：可选覆盖安装 APK，冷启动后按 PID 采集日志、截图与 JSON 报告；场景日志命中且应用在前台才标为 pass。没有场景证据或采集时应用未运行则为 review；画面与交互仍需确认。保留应用数据，不自动改签名或清空日志。
- 测试不再依赖本机 Creator 安装目录；增加隐私保留、模板重入、旧 NDK 参数转发与启动证据分类检查。

---

## 0.11.4 - 2026-11-08

- `onboard` 识别 Creator 2.4 的 `project.json`，用已安装的 2.4.15 导出 `build/jsb-link`，并写入宿主、JsbBridge 和 glory-adsdk。
- 2.4 游戏沿用已有的 `assets/adsdk`，不套 3.8 适配层快照。
- `oppo-sign` 在 `other/sign/certificate.pem` 不存在时改读 `sign/certificate.pem`。
- Creator 2.4 导出工程写入 `org.gradle.java.home`，避免 Android Studio 沿用全局 Java 11。

---

## 0.11.3 - 2026-11-08

- 按用户要求，游戏接入统一使用 `main`，不再创建 `feature/integrate_ad_sdk`。
- 同步命令帮助、README 和 AGENTS.md，增加已有 `main` 时不创建分支且保留工作区的回归检查。
- 保留提交不同则停止的保护，不自动合并、覆盖或删除分支。

---

## 0.11.2 - 2026-11-08

- `glory-game oppo-sign` 读取 `other/sign/certificate.pem`，输出 OPPO 后台要填的 MD5 签名。

---

## 0.11.1 - 2026-11-08

- 固定游戏接入分支为 `feature/integrate_ad_sdk`，`onboard` 自动创建或切换，保留现有提交和工作区改动。
- 已有同名分支与当前提交不同则停止提示，不覆盖分支；预演不创建或切换分支。
- README 和 AGENTS.md 记录游戏接入分支约定，增加分支行为回归测试。

---

## 0.11.0 - 2026-11-08

- SDK 优先复用本机同仓库、含指定 commit 的副本，连同 LFS 二进制复制并校验；已固定版本不再无条件 fetch。
- SDK 下载显示进度，默认 300 秒超时；保留下载暂存目录，支持重试和 `--sdk-source` / `--sdk-timeout-seconds`。
- 导出记录输入指纹；首次接入无需第二次 Creator 导出，输入不变时复用现有工程。
- `onboard` 默认自动打开最终 Android Studio 工程；`--no-open` 关闭，`open-studio` 单独打开。
- 修复 yaml 已填写密钥仍提示环境变量缺失，以及 appId/appKey 检查名称与阻断条件不一致的问题。
- 接入复检增加 LFS 文件完整性检查。测试不删除临时目录。

---

## 0.10.0 - 2026-11-07

### 新增

- `glory-game onboard`：读取游戏里已有的 `other/config/apk/oppoConfig`，写入 `glory-game.yaml`。缺 JS 适配层时从 `templates/js-adapter` 补齐；缺 Android 模板时先构建一次；然后 apply、sync，并覆盖当前 Android 工程。`--with-apk` 才编译 debug APK。
- `sync` 会把 yaml 里已填写的隐私协议地址和截止时间写入 `MyApplication`。

### 变更

- `cocos-build` 默认覆盖当前工程。已有 `build/android-*` 时沿用最新一份，并记在 `build/glory-cli/current-output.txt`。没有旧工程时使用 `build/android`。目录正在被 Gradle、CMake、Ninja 或 aapt2 编译时停止覆盖。
- 新游戏 `init-config` 钉死的 SDK commit 改为 `8abc0c887670a0736d577766d3950742e955c756`。
- 缺少 JS 适配层时，`apply` 在写宿主文件之前停止。

---

## 0.9.2 - 2026-10-25

### 新增

- `init-config` 和 `apply` 会补齐游戏仓 `.gitignore`：忽略 library、temp、build、profiles、日志和编辑器目录，只让 `native/engine/android` 与 `native/engine/common` 进版本库。
- `apply` 同时写 `native/engine/android/.gitignore`，忽略模块内 Gradle 缓存、`local.properties` 和 `app/libs`。不忽略 Gradle Wrapper，也不写入其他游戏的安装包路径。

### 修复

- `inspect` 判断模板能否入库时，检查 `native/engine/android`，避免「只跟踪 Android 模板」的规则被误判成整棵 `native/` 被忽略。

## 0.9.1 - 2026-10-25

### 修复

- Studio 工程名不再使用包名最后一段。OPPO 包名都以 `gamecenter` 结尾，以前每个新工程都会叫这个。现在优先用 `android.projectName`，否则用 `package.json` 的 `name`（`client` 这类占位名跳过），再否则用包名里的游戏段，例如 `com.evolution.shuiguopei.app.nearme.gamecenter` 得到 `shuiguopei`。`init-config` 会把结果写进 yaml。
- `apply` 固定 SDK commit 时挂上包含该提交的远程分支，不再 `checkout --detach`。Android Studio 顶栏显示分支名。远程分支已经超前时，HEAD 仍停在 yaml 钉死的提交。

## 0.9.0 - 2026-09-17

### 变更

- `cocos-build` 默认改为 release。明文调试必须显式 `--mode debug`。
- release 构建开启 `packages.native.encrypted=true`（XXTEA），脚本编成 `.jsc`。debug 保持明文。
- 命令输出会明确打印 `[RELEASE]` / `[DEBUG]`，以及加密是否开启。release 结束后检查 `data/` 是否有 `.jsc`。

## 0.8.1 - 2026-09-16

### 修复

- `sync` 按 `android-*` 目录名选最新工程，并写入所有已生成 `proj`。不再按文件夹 mtime，避免写到旧工程导致 Studio Rebuild 看不到改名。

## 0.8.0 - 2026-09-16

### 新增

- `game:` 只写一次 `appKey`、`appId`、`appSecret`。`glory-game sync` 灌到 Manifest、MyApplication、supplierconfig、gradle.properties。同一个 appId 两处都用。空着不覆盖。
- 桌面名、图标同样写在 `game.name` / `game.icon`（默认 `assets/icon/ic_launcher.png`），也走 sync。`apply` / `cocos-build` 会做同一套写入。

## 0.7.0 - 2026-09-15

### 新增

- `game.name` 作为桌面显示名，`game.icon` 指向一张本地 PNG。都不参与 `init-config`，手改 yaml 即可。
- `cocos-build` 把名字传给 Creator，并把图标拷到 `native/engine/android/res/mipmap-*/ic_launcher.png` 和生成工程。
- Gradle 模块名用 ASCII（`android.projectName` 或包名最后一段），不跟中文显示名绑在一起。

### 变更

- 改名字或图标后跑 `glory-game sync`，不用 `apply`，也不用再编 Creator。

## 0.6.0 - 2026-09-15

### 新增

- `cocos.startScene` 写入 `glory-game.yaml`，`cocos-build` 传给 Creator，不依赖对方电脑的 Cocos `profiles/`。
- `cocos-build` 开跑前按 yaml 检查 JDK 11、NDK `21.4.7075529`、CMake、platform，不对就停。
- 生成工程写入 `android.enableJetifier=true`、NDK 路径、JDK 11、`proj/.idea/vcs.xml`（Studio 顶栏）。
- `apply` 允许广告、隐私先空着，宿主留空。
- 接入文档：水果配完整步骤、给已接好 SDK 的人出工程的命令说明。

### 变更

- 没有 `native/engine/android` 时要两次 `cocos-build`：先出模板，`apply` 后再编一份给 Studio 打开。
- 日常不要跑 `integrate`（会编 Gradle）。打开最新 `build/android-时间戳/proj`，不要打开 `native/engine/android`。

## 0.5.0 - 2026-09-10

首个可用来接 Cocos 3.8.x Android 主库 SDK 的版本。

- `inspect` / `init-config` / `apply` / `cocos-build` / `android-build` / `integrate`
- 内置 `glory-oppo-cocos-3.8-v1` 共用配置，SDK 子模块钉死完整 commit
- 幂等改 Manifest、Gradle、AppActivity、MyApplication、supplierconfig、cocos-settings
