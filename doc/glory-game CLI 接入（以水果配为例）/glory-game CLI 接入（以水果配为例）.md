# glory\-game CLI 接入（以水果配为例）

把 OPPO 主库广告 SDK 接到 Cocos 3\.8\.x。示例工程 `ShuiGuoPeiPeiDui`，包名 `com.evolution.shuiguopei.app.nearme.gamecenter`，Creator 3\.8\.6。



不要跑 `glory-game integrate`（会编 Gradle）。游戏闪退、过关动画不是接入，见文末。



整条链路只有两套目录：

- `native/engine/android`：进 git 的模板。步骤 4 `apply` 改这里。不要用 Studio 打开它。

- `build/android-时间戳/proj`：Studio 打开并 Run 的工程。只有 `cocos-build` 会新建。永远打开最新那一份。

---



## **步骤 1  安装 CLI，指定工程**



- 干什么：让本机能运行 `glory-game`，并检查 JDK / NDK / Creator 齐不齐。

- 不干什么：不改游戏代码，不生成 Android 工程。

```Bash
cd /Users/aemon/Documents/project_new_games/glory-game-cli
npm link
glory-game use --project /Users/aemon/Documents/project_new_games/ShuiGuoPeiPeiDui
**glory-game inspect**
```



做完怎么确认：`inspect` 里 Creator、JDK 11、NDK 21\.4\.7075529、CMake 3\.22\.1、android\-29、Build Tools 30\.0\.3 都是 pass。



说明：`inspect` 可能显示 Creator 模板是 AGP 8 / JDK 17，那是 Creator 自带的，不要跟它走。终端 `JAVA_HOME` 是 8 也没关系，CLI 会自己找 11。广告密钥 Debug 可以不设。



---



## **步骤 2  写 glory\-game\.yaml**



- 干什么：记下这款游戏的包名、启动场景、NDK 版本、SDK commit。对方电脑没有你的 Cocos `profiles/`，这些必须写在 yaml 里并提交。

- 不干什么：不接 SDK，不编包。广告、隐私不要写进这个文件。



```Bash
cd /Users/aemon/Documents/project_new_games/ShuiGuoPeiPeiDui
**glory-game init-config**
```

![截屏2026\-09\-15 02\.46\.15\.png](图片和附件/截屏2026-09-15%2002.46.15.png)



只问包名。水果配填 `com.evolution.shuiguopei.app.nearme.gamecenter`。



做完怎么确认：打开 `glory-game.yaml`，至少有：

- `cocos.startScene` 是真正入口（水果配是 `assets/scene/Main.scene`）

- `android.ndkVersion` 是 `21.4.7075529`

- `sdk.commit` 是 40 位 hash

---



## **步骤 3  没有 Android 模板时，先 cocos\-build 一次**



- 干什么：让 Creator 生成 `native/engine/android` 空壳，后面的 `apply` 才有文件可改。

- 不干什么：这一遍编出来的 \`proj\` 还没接 SDK，**不要**用 Studio 当最终工程打开。不写 Jetifier，不改 Studio 顶栏。



只在还没有 `native/engine/android` 时做：

```Bash
**glory-game cocos-build**
```

![截屏2026\-09\-15 02\.47\.07\.png](图片和附件/截屏2026-09-15%2002.47.07.png)



做完怎么确认：游戏仓里出现 `native/engine/android/app`。

水果配 git 里已经有空壳，可以跳过。当天仍先编了一次，被别人的图片缓存路径卡住，见文末踩坑。



---



## **步骤 4  apply：改模板、挂 SDK**



- 干什么：在 `native/engine/android` 里接入宿主（Manifest、Activity、Application、Gradle 模块表），并把 `glory-adsdk` 加成 Git 子模块，checkout 到 yaml 钉死的 commit。



- 不干什么：

    - 不生成新的 `build/android-时间戳/proj`

    - 不写 `gradle.properties` 里的 Jetifier

    - 不改 Android Studio 顶栏

    - 不把广告 key 填进工程（没填就留空）

```Bash
**glory-game apply**
```

![截屏2026\-09\-15 02\.50\.49\.png](图片和附件/截屏2026-09-15%2002.50.49.png)





做完怎么确认：在游戏根目录执行（不必先 cd 进 SDK 目录）：

```Bash
git -C native/engine/android/glory-adsdk rev-parse HEAD
```



打印出来的 hash 必须等于 yaml 的 `sdk.commit`。对不上就是子模块漂到别的版本了。

本地改开屏广告只留本机，不要提交 SDK 仓。



---



## **步骤 5  再 cocos\-build：生成给 Studio 用的工程**



干什么：按已经 apply 过的模板，新建一份 `build/android-时间戳/proj`，并把生成工程收尾成能编、能开的状态。



这一步才会做掉你盯的那几件：

- 把启动场景传给 Creator（读 yaml 的 `startScene`）

- 在新 `proj/gradle.properties` 写入 `android.enableJetifier=true`、`android.useAndroidX=true`、NDK 路径、JDK 11

- 在新 `proj/.idea/vcs.xml` 写入 Git 映射，Studio 顶栏才能显示游戏仓和 glory\-adsdk

不干什么：不再改 `native/engine/android` 模板（那是步骤 4 的事）。不会更新你已经打开的旧 Studio 窗口。



```Bash
**glory-game cocos-build**
```

![截屏2026\-09\-15 02\.51\.36\.png](图片和附件/截屏2026-09-15%2002.51.36.png)





做完怎么确认：只打开最新这一份 `build/android-时间戳/proj`，然后三条都对：



1. 终端出现 `启动场景：...（glory-game.yaml）`

2. 打开 `proj/gradle.properties`，有 `android.enableJetifier=true`

3. Studio 顶栏能看到游戏根目录和 `native/engine/android/glory-adsdk`，不是无名 `proj`

缺任何一条：再跑一遍本步骤，用新 `proj` 打开。不要手改旧工程。然后在 Studio 里 Run 到真机，不要用 `android-build` 验证功能。



---



## **水果配当天：命令对上上面哪一步**

```Plain Text
glory-game init-config          # 步骤2
glory-game cocos-build          # 步骤3，失败：rocyang 的 imageCache
glory-game apply                # 步骤4，失败：当时广告必填
glory-game apply                # 步骤4，成功
glory-game cocos-build          # 步骤5，T172647 第一份能打开的工程
glory-game cocos-build          # 步骤5 再编，T175230 才有 Jetifier 和顶栏
```

后面再编的几遍是修游戏，不是接入。



接入踩坑：

- 图片压缩插件若写了别人电脑的绝对路径，步骤 3 会 `ENOENT mkdir /Users/rocyang/.../imageCache`。CLI 会改到本仓库 `build/imageCache`。

- 旧 CLI 的 apply 会要广告/隐私必填，现在可以空着。

- 步骤 5 之前的 `proj` 作废。Jetifier 和顶栏都在步骤 5，不在 apply。

要提交：yaml、apply 改过的宿主、SDK 子模块指针。不要提交 `profiles/`、`build/`、SDK 开屏的本地改法、密钥。



工具链版本（路径可以不同）：JDK 11、NDK 21\.4\.7075529、CMake 3\.22\.1、android\-29、Build Tools 30\.0\.3、生成工程 AGP 7\.4\.2 / Gradle 7\.6\.3。

---



## **附录：水果配后来的游戏问题（不是接入）**

- `startScene` 必须是真正入口，不要落到空的 `scene.scene`。

- Debug 下 STATIC drawInfo 超 4 会闪退；过关车不要用 Spine 缓存模式。

- 有多纹理插件时 Android 上 `SUPPORT_NATIVE = false`。

