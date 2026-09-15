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
