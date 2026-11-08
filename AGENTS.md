# 游戏接入分支约定

- 为游戏接入原生 SDK 时，游戏仓库固定使用 `main`；用户已明确要求，不另建接入分支。
- 这是所有后续游戏接入的长期约定，不限于某两个游戏。除非用户明确更改要求，不得自行改用其他分支。
- 不要将 `feature/integrate_ad_sdk` 或 `codex/*` 作为游戏的 SDK 接入分支。CLI 仓库自身的开发分支不受这条游戏分支约定影响。
- 创建或切换分支时保留现有提交、暂存区和工作区改动；已有接入分支与当前提交不同则先提示，不强制覆盖。

# Studio 接入验收

遇到 Studio 找不到构建任务，先阅读 [汉字拆呀拆接入复盘](doc/android-studio-gradle-task-import.md)，按证据区分 IDE 同步问题和游戏本身问题。

- open 命令返回成功只表示启动请求已发送；检查 Trust Project 弹框并核对实际窗口路径后，才报告工程已打开。
- Gradle 同步成功不等于构建任务可用。遇到 Unable to find Gradle tasks to build，先用 gradlew 的模块 tasks 命令验证任务存在，再检查 Studio 的 Configure all Gradle tasks during Gradle Sync 设置并重新同步。
- 修复后实际从 Studio 发起 Assemble 验证；临时切换离线模式时，完成后恢复原来的联网状态。
- 不通过删除缓存或导出目录来绕过该问题。

# 批量接入与运行验收

- 先阅读 [批量游戏接入经验](doc/batch-onboarding.md)，区分 CLI 通用宿主修复与游戏自身问题。
- Creator 2.4 的环境、桥接、隐私与增量资源修复应通过 CLI 同步，并持久化至 build-templates；不要只改 build 产物。
- 编译通过后用真机启动日志和截图验收；smoke-test 的场景日志 pass 不能替代画面和交互确认。
- doctor 发现游戏脚本资源包大小写或裸模块引用时，报告文件与行号；不要无证据批量改业务 JS。
- 不执行删除、清理缓存、卸载应用或清除数据的操作；确有需要时先征得用户许可。
