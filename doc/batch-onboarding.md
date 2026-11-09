# 批量游戏接入经验

目标是让后续游戏复用已验证的接入步骤，并保留足够证据定位例外。

## 从几款游戏里形成的约定

游戏仓库长期使用 main；保留原有提交和改动。CLI 自己的开发分支独立。提交、推送根据用户授权执行，onboard 本身不自动提交。

接入参数统一写 glory-game.yaml，保留游戏自己的身份、SDK 参数、隐私协议地址和时间策略。SDK 固定已验证 commit，本机有完整副本时优先复用。游戏声明的 Creator 版本优先保持，不为方便升级引擎。

Creator 3.8 与 2.4 使用各自的模板和工具链。2.4 沿用已有 assets/adsdk，不覆盖成 3.8 版本。发现游戏自身的 Cocos 问题后，根据运行证据单独修复。

## 一次接入怎么走

1. `glory-game doctor --project /path/to/game`：核对引擎、JDK、SDK、宿主与隐私配置，检查已知启动风险。
2. `glory-game onboard --project /path/to/game`：接入并准备 Android Studio 工程。只有发送了打开请求时，检查实际窗口路径和 Trust Project 提示。
3. 在 Studio 编译 Release，确认实际任务成功；命令行也可使用 `android-build --input <导出工程> --mode release`。
4. `glory-game smoke-test --project /path/to/game --apk /path/to/release.apk --expect-scene Home`：覆盖安装、冷启动、采集本次进程证据。场景名使用该游戏实际首页名称。
5. 查看截图与实际画面，确认进入首页、开始游戏和广告等交互。日志 pass 只说明指定场景日志与前台状态满足检查。

默认 onboard 只准备工程；`--with-apk` 才继续编译。真机连接和启动通过 smoke-test 显式发起。不清理构建目录、不卸载应用、不清除存档，也不自动改签名。

命令行 `android-build --mode release` 沿用已有的发布签名校验，需要完整 `android.signing` 配置及密码环境变量；未配置时明确停止，不将 Creator 测试签名当作发布签名。Studio 工程可以使用 Creator 原有测试签名完成本地 Release 验证。

## 已确认的重复问题

| 问题 | 证据与处理 | 沉淀位置 |
| --- | --- | --- |
| Studio 找不到模块任务 | 先核对路径、命令行 tasks，再检查 IDE Gradle 模型；Studio 实际 Assemble 验证 | [Studio 复盘](android-studio-gradle-task-import.md) |
| Studio 选了无效 JDK 路径，回退 Java 11 | `.gradle/config.properties` 配合 `#GRADLE_LOCAL_JAVA_HOME`；2.4 构建显式固定 Java 17 | 2.4 环境准备 |
| 旧 NDK 不识别 Apple 芯片或 make 路径带空格 | 工程自己的 NDK 包装器、Rosetta、无空格别名；全局 NDK 不变 | 2.4 环境准备 |
| SDK 能编译但缺桥接或运行依赖 | AppActivity 注册 main ready；补 SQLite factory、反射保留规则等 | 2.4 宿主模板 |
| Release 的 R8 缺少外部类 | SDK 固定版本的精确类名单；保留混淆，不开启全局 ignorewarnings | 2.4 R8 模板 |
| 游戏脚本找不到 js-base64 | 真机 Cannot find module；项目按锁定版本随 assets 提供实现和许可证 | doctor 提示；游戏按证据修复 |
| 90% loading，Home 找不到 | Android 路径区分大小写，实际 bundle 为 home；业务键和场景名无需跟着改 | doctor 提示；游戏按证据修复 |
| 修改脚本并重新导出后，新包仍运行旧脚本 | mergeAssets.doLast 的复制源未参与输入检查 | 2.4 模板声明完整资源输入 |
| 5 款游戏仍显示默认图标 | yaml 指向不存在的 assets/icon/ic_launcher.png，旧逻辑直接跳过；2.4 未同步 launcher 图标 | 自动识别已有品牌 PNG、缺失时报错、同步模板并由 doctor 检查 |
| 再次执行后漏隐私配置 | yaml 有值时更新，未填时保留宿主已有值；缺配置显式提示 | 2.4 宿主生成与 sync |

## 本次 CLI 更新的验证

回归测试覆盖 main 分支、SDK 本机复用与 LFS、导出复用、Studio 打开请求、签名输出，以及 2.4 模板重复执行、隐私保留、旧 NDK 参数转发和启动证据分类。测试使用仓库内 Creator 2.4 文本模板，不要求本机安装 Creator。

真实 Gradle 验证使用独立临时工程，保留全部测试文件：资源不变时 mergeReleaseAssets 为 UP-TO-DATE；修改一份资源后任务重新执行，输出含最新内容；再次不修改时恢复 UP-TO-DATE。

真机命令在已修复的我逆袭特牛 Release 上验证：冷启动采集到 Home 场景日志，前台检查通过，截图确认首页。此项验证的是新命令与已有 Release；不代表本轮重新编译了所有游戏或验收了所有广告交互。

Creator 2.4 的 app Java 源码直接引用 Git 跟踪的 build-templates/.../app/src；Studio 编辑后可以直接提交。build 下 Java 副本不参与 app 编译。
