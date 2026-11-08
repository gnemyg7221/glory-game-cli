# glory-game CLI

独立的 Cocos Android 主库接入 CLI。当前版本为 `0.11.3`，变更见 [CHANGELOG.md](CHANGELOG.md)。

按真实项目走一遍的步骤和踩坑，见 [接入水果配](doc/glory-game%20CLI%20接入（以水果配为例）/glory-game%20CLI%20接入（以水果配为例）.md)。给已接好 SDK 的人出工程，见 [cli 接入新工程开发指南](doc/%5B202609%5Dcli%20接入新工程开发指南/%5B202609%5Dcli%20接入新工程开发指南.md)。日常不要用 `integrate`。

## 当前能力

- 从仓库根或 Cocos 工程目录识别接入目标。
- 检查 Cocos Creator、Android 模板工具链、JDK、Android SDK/NDK/CMake。
- 检查 JS Native 桥、`native/` 模板和 glory-adsdk 接入状态。
- 生成接入计划。
- 初始化不带猜测值的游戏配置。
- 内置 `glory-oppo-cocos-3.8-v1` 共用配置，复用 AttackMonster 已验证的 Cocos/Android/SDK 版本。
- 幂等修改 Manifest、Gradle、AppActivity、MyApplication、supplierconfig 和 Cocos settings。
- 添加 SDK Git 子模块并固定到完整的 40 位 commit。
- 调用 Creator 构建 Android 工程。
- 调用 Gradle 构建 APK，并验证包名、版本、ABI、Launcher、assets 和签名。
- 一条 `integrate` 命令串联 bootstrap、接入、Cocos 构建、Gradle 构建和 APK 验收。

Cocos Creator 3.8.x 走 `native/engine/android`。Creator 2.4 走 `project.json` 和 `build/jsb-link`，沿用游戏里已有的 `assets/adsdk`。3.8 缺失适配层时 `onboard` 才从内置快照补齐，不覆盖已有同名文件。

## 直接运行

```bash
node /Users/aemon/Documents/project_new_games/glory-game-cli/bin/glory-game.mjs inspect \
  --project /path/to/game-or-repository
```

例如：

```bash
node bin/glory-game.mjs inspect \
  --project /Users/aemon/Documents/project_new_games/Doudoupin

node bin/glory-game.mjs inspect \
  --project /Users/aemon/Documents/project_new_games/AttackMonster \
  --config /Users/aemon/Documents/project_new_games/AttackMonster/glory-game.config.json
```

## 注册为本机命令

在本目录执行：

```bash
npm link
glory-game inspect --project /path/to/game-or-repository
```

已经 link 过的，拉最新分支后在本目录更新：

```bash
git pull
npm install
glory-game version
```

一般不用再 `npm link`。`package.json` 的依赖或 `bin` 变了才需要再 link 一次。打印出来的号应和 `package.json` 一致。

要求 Node.js 18 或更高版本；`npm install` 安装配置解析依赖。

## 配置

可以让 CLI 生成配置骨架：

```bash
glory-game init-config --project /path/to/game-or-repository
```

终端交互只询问 `Android packageName`。游戏名和 Creator 版本从工程读取；AGP、Gradle、JDK、API、ABI、Build Tools、NDK、CMake、SDK 地址及 SDK commit 使用已验证共用配置。其他游戏专属参数保持 `REQUIRED` 或 `null`，可以以后分批补。也可以用 `--stdout` 只输出、不写文件。

`game:` 里只填一次：`name`、`icon`、`appKey`、`appId`、`appSecret`。然后 `glory-game sync`。同一个 `appId` 会写进 MyApplication 和 supplierconfig；`appKey` 进 Manifest；`appSecret` 进 gradle.properties，MyApplication 从 BuildConfig 读。空着不覆盖宿主。Android Studio 打开当前这份 `build/<当前工程>/proj`。

随时查看还缺哪些游戏专属参数：

```bash
glory-game status --project /path/to/game-or-repository
```

配置格式参考 [示例配置](examples/glory-game.config.example.json)。`game.appSecret` 可从 `oppoConfig` 自动导入，也可使用 `gameCenterAppSecretEnv` 指定的环境变量。Release 签名密码只通过环境变量传入。

## 接入流程

新游戏在仓库根目录执行。`glory-game onboard` 读取游戏里已有的 `other/config/apk/oppoConfig`，写入 `glory-game.yaml`。

**所有后续游戏接入统一使用 `main`，不另建接入分支。此约定长期有效，不限于某两个游戏，除非用户明确更改要求。** `onboard` 在写入接入文件前确认当前分支；已经在 `main` 时直接继续，不切换分支。缺少 `main` 时从当前提交创建；已有 `main` 与当前提交相同时才直接切换，提交不同时停止提示先核对，不覆盖任何分支或提交。保留暂存区和工作区改动；`--dry-run` 不创建或切换分支。CLI 仓库自身的开发分支不受此约定影响。此步骤不自动提交或推送。

```bash
glory-game onboard --dry-run
glory-game onboard
```

这条命令会补齐 `glory-game.yaml`、缺失的 JS 广告适配层和 Android 模板，接入 SDK，并自动用 Android Studio 打开最终的 `proj`。默认到这里完成，不编译 APK。已有同名文件不会被适配层覆盖。

`cocos-build` 默认也覆盖这一份工程，不再每次新建 `android-时间戳`。第一次没有旧工程时使用 `build/android`。指定 `--output-name` 只影响这一次，不改当前工程。

`integrate` 会继续编 Gradle。接入用 `onboard`。需要命令行 debug 包时给 `onboard` 加 `--with-apk`。

不想自动打开 Studio 时使用 `--no-open`；以后只打开现有工程：

```bash
glory-game open-studio --project /path/to/game
```

SDK 优先复用本机已接入游戏中同一远程仓库、包含指定 commit 的版本。源码和 LFS 管理的 AAR/JAR 一起复制并校验，不借用其他工程的 Git 对象目录。也可以用 `--sdk-source /path/to/glory-adsdk` 指定本机来源。原来的远程地址和钉死 commit 保持不变。

本机缺少时才下载指定 commit 和缺少的 LFS 文件，显示实时进度。单次下载默认最多等待 300 秒，可用 `--sdk-timeout-seconds 600` 或 `sdk.timeoutSeconds` 调整。下载暂存目录保留在 `build/glory-cli/sdk-download/`，失败后重新运行同一命令继续。

首次生成模板只导出一次。每次成功导出会记录资源和构建配置指纹，后续仅修改 Android 宿主配置时复用产物并同步配置；资源、脚本、入口或构建选项变化时重新导出。旧工程没有记录时会重新导出一次，以建立可靠基线。


只改桌面名、图标、appKey、appId、appSecret 时：

```bash
glory-game sync --dry-run
glory-game sync
```

步骤和接入踩坑见 [接入水果配](doc/glory-game%20CLI%20接入（以水果配为例）/glory-game%20CLI%20接入（以水果配为例）.md)。游戏闪退、过关动画不在该文档的主流程里。

如果 `native/engine/android` 已经生成，也可以只应用 SDK 宿主改造：

```bash
glory-game apply --project /path/to/game --config /absolute/path/to/config.json --dry-run
glory-game apply --project /path/to/game --config /absolute/path/to/config.json
```

`apply` 会在 `build/glory-cli/backups/<timestamp>` 保存被修改文件的原内容，不会删除旧文件。

## 接入与启动验收

后续游戏按“预检 → 接入 → 编译 → 真机验收”处理。详细经验和验收边界见 [批量游戏接入经验](doc/batch-onboarding.md)。

```bash
glory-game doctor --project /path/to/game
glory-game onboard --project /path/to/game
glory-game smoke-test --project /path/to/game --apk /path/to/release.apk --expect-scene Home
```

`doctor` 只读，检查工具链和宿主；Creator 2.4 还扫描字面量资源包引用的大小写和裸 `js-base64` 引用。报告源码位置，业务脚本不自动改写。已确认的问题以 fail 报告；裸模块是待核对的 warn，静态检查不能覆盖所有运行时路径。

2.4 的 Java 17、Studio JDK、Gradle 内存、旧 NDK 和空格路径由 CLI 准备，接入修复同时写入 `build-templates/jsb-link`，不再要求游戏另跑 Python 准备脚本。Apple 芯片需已安装 Rosetta；缺少时给出明确提示。3.8 保留原有工具链流程。

在 yaml 配置 `privacy.policyUrl` 和 `privacy.skipBeforeTime`，再 `glory-game sync`。未填项保留宿主已有值，CLI 不替游戏猜协议地址或截止时间。

`smoke-test` 默认观察 35 秒，可用 `--seconds` 调整至 1–120 秒；多设备用 `--serial`。`--apk` 可省略以测试已安装版本；提供时先验证 APK 再覆盖安装。签名不匹配时停止，不自动卸载或改签。`--capture-only` 只采集当前进程，不启动或安装；`--dry-run` 不操作设备。

证据保存在游戏的 `build/glory-cli/device-smoke/时间戳/`。指定场景出现 `LoadScene 场景名:` 日志、没有已识别的阻塞错误且应用处于前台时，日志检查为 pass；其余无充分证据的情况为 review。**请查看截图，确认画面正常，再验收交互和广告。** 该命令不清除数据、不清空设备日志、不自动确认隐私或点击广告。

## Studio 提示找不到构建任务

完整复盘见 [Android Studio 找不到构建任务：汉字拆呀拆接入复盘](doc/android-studio-gradle-task-import.md)，包含环境、日志证据、修复步骤和真实 APK 验收结果。

遇到 `Unable to find Gradle tasks to build: [:模块名]` 时，先核对当前窗口路径和包名，再检查命令行是否能列出该模块任务。例如在导出的 `proj` 目录执行：

```bash
./gradlew :NumberLianLian:tasks --all --offline
```

如果命令行有 `assembleRelease` / `assembleDebug`，但 Studio 找不到，检查 **Settings → Experimental → Gradle → Configure all Gradle tasks during Gradle Sync**，启用后重新 **Sync Project with Gradle Files**。等同步完成，再用 Studio 的 Assemble 按钮确认实际开始执行构建任务。汉字拆呀拆曾通过此流程恢复。

依赖已缓存时可临时启用 Gradle Offline Mode 加快复检，完成后恢复原来的联网状态。不要用删除导出目录、构建缓存或重新导出 Cocos 来代替模块模型排查。

## OPPO 应用签名

```bash
glory-game oppo-sign
```

读取 `other/sign/certificate.pem`，输出去掉冒号的小写 MD5。这串填进 OPPO 开放平台的应用签名。

## Release 签名

keystore 路径和 alias 写在 `android.signing`，两个密码只通过配置指定的环境变量传给 Gradle。可设置 `certificateSha256`，让 APK 验收确认最终签名证书。

```bash
export GLORY_RELEASE_STORE_PASSWORD='<store password>'
export GLORY_RELEASE_KEY_PASSWORD='<key password>'
glory-game integrate --project /path/to/game --config /absolute/path/to/config.json --mode release
```

## 自检

`npm test` 验证 SDK 本机复用与 LFS、超时、导出复用、配置复检及自动打开 Studio。测试临时文件保留，不执行删除。

`self-test` 会读取对应 Creator 的原始 Android 模板，验证转换能识别模板、生成有效 XML，而且重复运行不会继续改变结果：

```bash
glory-game self-test --project /path/to/game --config /absolute/path/to/config.json
```

## 安全约束

- 不执行删除。
- `cocos-build` 只覆盖当前选定的输出目录，检测到该目录正在编译时停止；不清理其他目录。
- 支持 `--dry-run` 的命令会先展示计划。
- 无法识别的模板结构会停止，不会猜测并强行修改。
- 现有自定义 `MyApplication` 无法安全合并时会停止。
- SDK 使用完整 commit 固定，不接受浮动分支。
