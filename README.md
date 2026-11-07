# glory-game CLI

独立的 Cocos Android 主库接入 CLI。当前版本为 `0.11.0`，变更见 [CHANGELOG.md](CHANGELOG.md)。

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

当前接入器针对 Cocos Creator 3.8.x。已有 JS Native 广告适配层会保留；缺失时 `onboard` 从内置快照补齐，不覆盖已有同名文件。

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
