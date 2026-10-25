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
