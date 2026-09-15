# glory-game CLI

独立的 Cocos Android 主库接入 CLI。当前版本为 `0.5.0`。

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

当前接入器针对 Cocos Creator 3.8.x。游戏必须已经包含可识别的 JS Native 广告适配层；CLI 不会用其他游戏的 JS 代码覆盖它。

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

CLI 没有第三方运行时依赖，要求 Node.js 18 或更高版本。

## 配置

可以让 CLI 生成配置骨架：

```bash
glory-game init-config --project /path/to/game-or-repository
```

终端交互只询问 `Android packageName`。游戏名和 Creator 版本从工程读取；AGP、Gradle、JDK、API、ABI、Build Tools、NDK、CMake、SDK 地址及 SDK commit 使用已验证共用配置。其他游戏专属参数保持 `REQUIRED` 或 `null`，可以以后分批补。也可以用 `--stdout` 只输出、不写文件。

随时查看还缺哪些游戏专属参数：

```bash
glory-game status --project /path/to/game-or-repository
```

配置格式参考 [示例配置](examples/glory-game.config.example.json)。密钥配置只填写环境变量名，不要把密钥写入文件。

## 接入流程

没有 `native/engine/android` 时是两次 `cocos-build`：

```bash
glory-game init-config
glory-game cocos-build    # 生成 Android 模板
glory-game apply
glory-game cocos-build    # 生成带 SDK 的 proj，Studio 打开这一份
```

已有模板可跳过第一次 `cocos-build`。打开最新 `build/android-*/proj`，不要打开 `native/engine/android`。`integrate` 会编 Gradle，日常不用。

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

`self-test` 会读取对应 Creator 的原始 Android 模板，在内存中验证转换能识别模板、生成有效 XML，而且重复运行不会继续改变结果：

```bash
glory-game self-test --project /path/to/game --config /absolute/path/to/config.json
```

## 安全约束

- 不执行删除。
- 已存在的 Cocos 输出目录不会被覆盖。
- 支持 `--dry-run` 的命令会先展示计划。
- 无法识别的模板结构会停止，不会猜测并强行修改。
- 现有自定义 `MyApplication` 无法安全合并时会停止。
- SDK 使用完整 commit 固定，不接受浮动分支。
