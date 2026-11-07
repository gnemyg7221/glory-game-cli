# Android Studio 找不到构建任务：汉字拆呀拆接入复盘

记录日期：2026-11-08。适用于接入后已生成 Android 工程，但 Studio 无法发起构建的排查。

**本次问题出在本机 Android Studio 的 Gradle 任务导入设置。** Gradle 本身有构建任务，Studio 却没有正确建立模块与任务的映射。开启完整任务配置并重新同步后，直接从 Studio 成功构建出了 APK，未修改游戏代码或 Gradle 工程配置。

这是一例经过验证的处理过程；同样的报错仍应先核对证据，不直接套用结论。

## 1. 环境和现象

| 项目 | 本次记录 |
|---|---|
| 游戏 | 汉字拆呀拆，仓库 HanZiChaiYaChai |
| 游戏接入分支 | feature/integrate_ad_sdk |
| Creator | 3.8.6 |
| Android Studio | Narwhal 2025.1.1 Patch 1 |
| AGP / Gradle | 7.4.2 / 7.6.3 |
| 构建 JDK | Eclipse Temurin 11.0.27 |
| 工程入口 | 游戏目录下的 build/android/proj |
| Gradle 模块 | :NumberLianLian |

Studio 点击 Run 或 Assemble 时提示：

```text
Unable to find Gradle tasks to build: [:NumberLianLian].
Build mode: ASSEMBLE.
```

接入文件检查通过，Studio 也报告过同步成功，但实际无法开始构建。

## 2. 先排除三个容易混淆的现象

### Trust Project 会阻止工程真正打开

CLI 的“已打开 Android Studio”只表示系统接受了启动请求。首次打开项目时，Studio 可能停在 Trust Project 弹框。

应核对待打开目录，确认进入目标工程窗口，再报告“工程已打开”。这次打开的是本地生成的项目，只确认当前项目；不扩大到信任整片目录。

### 工程名不等于游戏名，也不能据此判断导错目录

这个游戏的 package.json.name 原本是 NumberLianLian，CLI 将它用作 Gradle 工程和模块名。因此 Studio 显示 NumberLianLian。

核对依据应是实际路径及应用身份：

- 窗口路径：HanZiChaiYaChai/build/android/proj。
- 生成工程 gradle.properties 的 NATIVE_DIR、RES_PATH 指向 HanZiChaiYaChai。
- APPLICATION_ID：com.evolution.hanzichai.app.nearme.gamecenter。
- 桌面名称：汉字拆呀拆。

本次目录、包名均正确。没有通过重命名模块来修复构建任务问题。

### 同步成功不等于构建任务可用

Studio 的 Sync 成功只能说明该轮同步结束。必须进一步确认 IDE 能实际发起该应用模块的 Assemble，才能判断构建入口可用。

## 3. 定位证据

### 命令行有任务

在导出的 proj 目录，使用配置要求的 JDK 检查真实 Gradle 模块和任务：

```bash
cd /path/to/game/build/android/proj

JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-11.jdk/Contents/Home \
  ./gradlew projects --offline

JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-11.jdk/Contents/Home \
  ./gradlew :NumberLianLian:tasks --all --offline
```

模块名以 projects 的实际输出为准，不固定猜成 :app。JDK 路径也应使用本机实际安装位置。

本次命令成功，能列出 assembleDebug、assembleRelease、installDebug、installRelease。这说明 Gradle 工程自身并没有缺少构建任务。

--offline 仅适用于依赖已缓存的场景；缺少依赖时应恢复联网后重试。

### Studio 的任务映射异常

idea.log 中出现过：

```text
getGradleProjectPath(Module: 'NumberLianLian.NumberLianLian') == null
Unable to find Gradle tasks to build: [:NumberLianLian]. Build mode: ASSEMBLE
```

修复前，Studio 传给 Gradle 的参数包含：

```text
-Pidea.gradle.do.not.build.tasks=true
-Pandroid.injected.avoid.task.registration=true
```

这将排查重点指向 IDE 的任务导入与模块模型，而不是游戏脚本、相机、分包或原生渲染。

## 4. 本次修复步骤

1. 打开 Android Studio 的 Settings → Experimental → Gradle。
2. 勾选 Configure all Gradle tasks during Gradle Sync (this can make Gradle Sync slower)。
3. 执行 Sync Project with Gradle Files，等待本轮同步完成。
4. 从 Studio 的 Assemble 按钮实际发起构建，检查是否执行应用模块的 assembleRelease 或 assembleDebug。
5. 等构建结束，核对 APK 的包名、入口、版本、ABI 和签名。

上述菜单名称对应本次 Studio 版本，其他版本应按实际界面查找。

本次为避免已缓存依赖重复等待仓库网络请求，临时开启过 Gradle Offline Mode；验证完成后已恢复联网状态。离线模式只是加速本次复检，不是修复任务映射的必要条件。

修复后，同步参数变为：

```text
-Pidea.gradle.do.not.build.tasks=false
-Pandroid.injected.avoid.task.registration=false
```

本机 Studio 的 gradle.experimental.xml 也记录为：

```xml
<component name="GradleExperimentalSettings">
  <option name="SKIP_GRADLE_TASKS_LIST" value="false" />
</component>
```

这段 XML 用来对照本次结果，不应直接覆盖其他机器的完整配置文件。该设置属于本机 IDE 环境，不会随游戏仓库或 CLI 安装自动迁移。

## 5. 修复后的实际验收

Studio 已真正执行：

```text
Executing tasks: [:NumberLianLian:assembleRelease]
```

随后完成两个架构的 Cocos 原生编译和 APK 打包。使用 glory-game verify-apk 对产物检查，失败项为 0：

| 检查项 | 结果 |
|---|---|
| 包名 | com.evolution.hanzichai.app.nearme.gamecenter |
| 桌面名称 | 汉字拆呀拆 |
| 版本 | 1.0.0 |
| ABI | arm64-v8a、armeabi-v7a |
| Launcher | com.glory.adsdk.launch.GloryAdLaunchActivity |
| 签名 | CocosCreator 测试证书 |

本次 APK 位于：

```text
build/android/proj/build/NumberLianLian/outputs/apk/release/NumberLianLian-release.apk
```

虽然任务名是 assembleRelease，本次仍使用 Creator 测试签名。正式发布另行配置发布签名。

验收应区分以下层级：

| 层级 | 完成依据 |
|---|---|
| 接入文件就绪 | CLI 配置、宿主、SDK 版本和 LFS 文件检查通过 |
| IDE 已打开 | Trust 弹框已处理，实际窗口路径正确 |
| IDE 可构建 | Studio 发起真实 Assemble 并成功生成 APK，产物检查通过 |
| 游戏运行正常 | 真机验证启动、场景切换、广告和后台恢复等流程 |

这次记录确认到“IDE 可构建”。不能由此断言没有 Cocos 游戏运行问题。

## 6. 后续处理原则

- 先区分游戏导出失败、IDE 模型导入异常、实际编译失败和真机运行异常。
- CLI inspect 通过、open 命令成功或 Sync 成功，都不能单独代替实际构建验收。
- 命令行任务存在而 Studio 找不到时，优先检查 IDE 同步设置和模块映射。
- 本次不需要重导出 Cocos，也不需要修改游戏 JS、包名或 SDK 代码。
- 保留已有工程和缓存。任何删除操作必须先取得用户许可，不执行 clean 或清目录来代替定位。
- 临时修改离线等环境选项后恢复原状态；换电脑时重新确认 IDE 设置。
