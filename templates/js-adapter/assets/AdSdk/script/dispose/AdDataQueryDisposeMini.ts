import { instantiate, Node } from "cc"
import { CustomAd2Manager } from "../ad/CustomAd2Manager"
import { CustomAdManager } from "../ad/CustomAdManager"
import { OpenAPIManager } from "../platform/OpenAPIManager"
import { RewardedVideoAdManager } from "../ad/RewardedVideoAdManager"
import { RewardedVideoWaterfall } from "../ad/RewardedVideoWaterfall"
import ResMgr, { AssetType } from "../manager/ResMgr"
import { ClientMonitorType, EventType, NetWorkManager } from "../network/NetWorkManager"
import { LaunchData, SystemInfo } from "../platform/Base/BaseOpenAPI"
import { AdUtils } from "../utils/AdUtils"
import { EnvUtils } from "../utils/EnvUtils"
import { ViewUtils } from "../utils/ViewUtils"
import AdAlertView from "../view/AdAlertView"
import { ClickShowAdNode } from "../view/ClickShowAdNode"
import PrivacyAlert from "../view/PrivacyAlert"
import { AdGlobal, ShowMoreAdType } from "./AdGlobal"
import { AdDataQueryDisposeBase } from "./AdDataQueryDisposeBase"

export class AdDataQueryDisposeMini extends AdDataQueryDisposeBase {

    public privacyAlert: PrivacyAlert = null;
    public clickShowAdNode: ClickShowAdNode = null;
    public adRedAlertNode: AdAlertView = null

    public async initLoadingView() {
        if (this.adRedAlertNode) {
            return;
        }
        let node = ViewUtils.createFullScreenTopNode('LoadAdFullScreenRoot')
        await ResMgr.ins.loadBundle('AdSdk/adbundle', 'adbundle')
        await ResMgr.ins.loadRes('adbundle', AssetType.Prefab)
        let adAlertViewPrefab = await ResMgr.ins.getPrefab('adbundle', 'AdAlertView')
        this.adRedAlertNode = instantiate(adAlertViewPrefab).getComponent(AdAlertView);
        node.addChild(this.adRedAlertNode.node)
        ViewUtils.setLayer(this.adRedAlertNode.node)
        this.adRedAlertNode.node.active = false
    }

    public async initHomeView() {
        if (this.privacyAlert) {
            return;
        }
        let node = ViewUtils.createFullScreenTopNode('HomeAdFullScreenRoot')
        await ResMgr.ins.loadBundle('AdSdk/adbundle', 'adbundle')
        await ResMgr.ins.loadRes('adbundle', AssetType.Prefab)
        let clickShowAdNodePrefab = await ResMgr.ins.getPrefab('adbundle', 'ClickShowAdNode')
        let privacyAlertPrefab = await ResMgr.ins.getPrefab('adbundle', 'PrivacyAlert')
        this.clickShowAdNode = instantiate(clickShowAdNodePrefab).getComponent(ClickShowAdNode);
        this.privacyAlert = instantiate(privacyAlertPrefab).getComponent(PrivacyAlert);
        node.addChild(this.clickShowAdNode.node)
        node.addChild(this.privacyAlert.node)
        // Prefabs ship on DEFAULT; Main Camera draws that layer over the 3D stage.
        ViewUtils.setLayer(this.clickShowAdNode.node)
        ViewUtils.setLayer(this.privacyAlert.node)
        this.clickShowAdNode.node.active = false
        this.privacyAlert.node.active = false
    }

    private updateGlobalData = async (launchData: LaunchData, systemInfo: SystemInfo) => {
        // 设置渠道信息
        AdGlobal.companyKey = systemInfo.companyKey
        AdGlobal.appKey = systemInfo.appKey
        AdGlobal.channel = launchData?.query?.channel
        AdGlobal.useRenderAd = launchData?.query?.useRenderAd
        AdGlobal.group = launchData?.query?.group
        AdGlobal.version = systemInfo.version
        AdGlobal.brand = systemInfo.brand
        AdGlobal.platformVersionCode = systemInfo.platformVersionCode

        // 其他参数
        AdGlobal.options = launchData?.query
        AdGlobal.clickId = launchData?.query?.clickId
        AdGlobal.forbidPrivacyDialog = systemInfo.forbidPrivacyDialog
        OpenAPIManager.inst.adUsableStr = launchData?.query?.adUsableStr

        // 唯一标识
        AdGlobal.oaid = systemInfo.oaid
        AdGlobal.imei = systemInfo.imei
        AdGlobal.androidId = systemInfo.androidId
        AdGlobal.deviceId = await AdGlobal.getDeviceId()
        AdGlobal.multipleAd = systemInfo.multipleAd

        if (!launchData?.query?.multipleAd || launchData?.query?.multipleAd === 'false') {
            AdGlobal.multipleAd = false
        }

        if (!AdGlobal.channel || AdGlobal.channel.length === 0) {
            AdGlobal.channel = 'NATURAL'
        }

        if (EnvUtils.VIVO()) {
            let updateChannel = AdUtils.getUpdateChannel()
            if (updateChannel) {
                AdGlobal.channel = updateChannel
            }
        }
    }

    // 处理渠道请求
    public async disposeChannelData() {

        OpenAPIManager.inst.addOnHideListener('home_on_hideListener', this.startOnHideListener)
        OpenAPIManager.inst.addOnShowListener('home_on_showListener', this.startOnShowListener)

        let launchData = await OpenAPIManager.inst.getLaunchOptionsAsync()
        let systemInfo = await OpenAPIManager.inst.getSystemInfo()

        await this.updateGlobalData(launchData, systemInfo)

        // 查询游戏配置
        let gameConfig = await NetWorkManager.inst.getGameConfig()

        // 优先使用服务端渠道
        if (gameConfig && gameConfig.channel && gameConfig.channel !== AdGlobal.channel) {
            AdGlobal.channel = gameConfig.channel
        }

        // 设置服务端AB实验分组
        if (gameConfig && gameConfig.group) {
            AdGlobal.group = gameConfig.group
        } else {
            AdGlobal.group = 'normal'
        }

        // 设置游戏启动参数
        if (launchData?.query?.group) {
            AdGlobal.group = launchData?.query?.group
        }

        if (gameConfig && gameConfig.adType) {
            AdGlobal.adType = gameConfig.adType
        }

        // AdGlobal.adType = ShowMoreAdType.MIDDLE

        if (!window["startJsRun"]) {
            NetWorkManager.inst.uploadEventData('app_start', EventType.Frequency)
        }

        // 设置上传条件
        if (gameConfig && gameConfig.uploadAdIncome) {
            AdGlobal.uploadAdIncome = gameConfig.uploadAdIncome
        }

        if (gameConfig && gameConfig.adSpaceTypeEcpmInfoV2) {
            AdGlobal.adSpaceTypeEcpmInfo = gameConfig.adSpaceTypeEcpmInfoV2
        }

        if (gameConfig && gameConfig.useBidding === false) {
            AdGlobal.useBidding = false
        }

        if (gameConfig && gameConfig.startShowAdCount !== undefined && gameConfig.startShowAdCount !== null) {
            AdGlobal.startShowAdCount = gameConfig.startShowAdCount
        }

        if (gameConfig && gameConfig.restartMaxCount !== undefined && gameConfig.restartMaxCount !== null) {
            AdGlobal.restartMaxCount = gameConfig.restartMaxCount
        }

        if (gameConfig && gameConfig.adShowLoopTimeout !== undefined && gameConfig.adShowLoopTimeout !== null) {
            AdGlobal.adShowLoopTimeout = gameConfig.adShowLoopTimeout
        }

        if (gameConfig && gameConfig.startShowCustomAdCount !== undefined && gameConfig.startShowCustomAdCount !== null) {
            AdGlobal.startShowCustomAdCount = gameConfig.startShowCustomAdCount
        }

        AdGlobal.adUnitIdEcpmInfo = gameConfig?.adUnitIdEcpmInfo;

        if (AdGlobal.multipleAd) {
            RewardedVideoWaterfall.inst.addNewAdToList(3)
        } else {
            RewardedVideoAdManager.inst.preloadAd()
        }

        // 上传启动归因
        if (AdGlobal.channel != 'NATURAL') {
            NetWorkManager.inst.uploadAttributionData(ClientMonitorType.START)
        }

        // 启动不展示广告的用户数
        if (AdGlobal.adType === ShowMoreAdType.NONE) {
            NetWorkManager.inst.uploadEventData('app_start_no_ad', EventType.Frequency)
        }

        if (AdGlobal.adType === ShowMoreAdType.LOW) {
            NetWorkManager.inst.uploadEventData('app_start_low_ad', EventType.Frequency)
        }

        if (AdGlobal.adType === ShowMoreAdType.MIDDLE) {
            NetWorkManager.inst.uploadEventData('app_start_middle_ad', EventType.Frequency)
        }

        if (AdGlobal.adType === ShowMoreAdType.HIGH) {
            NetWorkManager.inst.uploadEventData('app_start_high_ad', EventType.Frequency)
        }
        if (EnvUtils.OPPO()) {
            if (AdGlobal.adType === ShowMoreAdType.HIGH) {
                this.showMoreRewardedAdHigh()
            }
        }

        if (EnvUtils.VIVO()) {
            if (AdGlobal.adType === ShowMoreAdType.HIGH) {
                this.showMoreRewardedAdHigh()
                let customAdTimer = null
                let customAdShowCount = 0
                AdGlobal.startAdIsShow = true
                CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => { }, CustomAdManager.inst.topAdStyle())
                setTimeout(() => {
                    customAdTimer = setInterval(() => {
                        CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => { }, CustomAdManager.inst.topAdStyle())
                        customAdShowCount++
                        if (customAdShowCount > AdGlobal.startShowCustomAdCount) {
                            clearInterval(customAdTimer)
                            setTimeout(() => {
                                AdGlobal.startAdIsShow = false
                            }, 3000);
                        }
                    }, 3000);
                }, 1000);
            }

            if (AdGlobal.adType === ShowMoreAdType.MIDDLE) {
                this.showMoreRewardedAdHigh(1)
                let customAdTimer = null
                let customAdShowCount = 0
                AdGlobal.startAdIsShow = true
                CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => { }, CustomAdManager.inst.topAdStyle())
                setTimeout(() => {
                    customAdTimer = setInterval(() => {
                        CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => { }, CustomAdManager.inst.topAdStyle())
                        customAdShowCount++
                        if (customAdShowCount > 2) {
                            clearInterval(customAdTimer)
                            setTimeout(() => {
                                AdGlobal.startAdIsShow = false
                            }, 3000);
                        }
                    }, 3000);
                }, 1000);
            }
        }

        if (EnvUtils.RONGYAO()) {
            if (AdGlobal.adType === ShowMoreAdType.HIGH && !window["showStartVideoWillShow"]) {
                if (AdGlobal.useRenderAd === 'true') {
                    if (this.adRedAlertNode && AdGlobal.platformVersionCode >= 1205 && qg.createSelfRenderAd) {
                        await this.adRedAlertNode.init()
                    } else {
                        this.showMoreRewardedAdHigh()
                    }
                } else {
                    this.showMoreRewardedAdHigh()
                }
            }
        }
        // 开始查询归因
        AdGlobal.inst.startQueryKeyAction()
    }

    private showMoreRewardedAdHigh = async (startShowAdCount?: number, startErrorCount?: number, timeOut?: number) => {
        if (AdGlobal.startAdIsShow) {
            return
        }
        AdGlobal.startAdIsShow = true

        let maxShowCount = startShowAdCount || AdGlobal.startShowAdCount
        let maxErrorCount = startErrorCount || 500
        let errorCount = 0
        let showCount = 0

        RewardedVideoAdManager.inst.needEndPreload = false
        for (let index = 0; index < 10000; index++) {
            if (window["showStartVideoWillShow"] && !window["showStartVideoShowed"]) {
                await AdUtils.timeOut(1000)
                continue
            }
            let result = null
            if (AdGlobal.multipleAd) {
                result = await RewardedVideoWaterfall.inst.asyncShow()
            } else {
                result = await RewardedVideoAdManager.inst.asyncShow()
            }
            if (result.success) {
                showCount++
            } else {
                errorCount++
            }

            if (showCount >= maxShowCount || errorCount >= maxErrorCount) {
                break
            }

            if (timeOut) {
                await AdUtils.timeOut(timeOut)
            }

            if (EnvUtils.VIVO()) {
                await AdUtils.timeOut(200)
            } else {
                if (result.success) {
                    await AdUtils.timeOut(100)
                } else {
                    await AdUtils.timeOut(2000)
                }
            }

        }
        AdGlobal.startAdIsShow = false
    }

    private startOnShowListener = (res: any) => {
        AdGlobal.gameIsActive = true
        AdGlobal.onShowCount++
    }

    private startOnHideListener() {
        AdGlobal.gameIsActive = false
        if (window["showStartVideoWillShow"] && !window["showStartVideoShowed"]) {
            return
        }

        // if (EnvUtils.VIVO()) {
        //     AdUtils.nativeApplyUpdate()
        // }

        if ((AdGlobal.adType === ShowMoreAdType.HIGH || AdGlobal.adType === ShowMoreAdType.MIDDLE) && (EnvUtils.OPPO() || EnvUtils.HUAWEI())) {

            if (CustomAd2Manager.inst.nativeAdIsClick()) {
                return
            }

            if (CustomAdManager.inst.isClick()) {
                return
            }

            if (RewardedVideoAdManager.inst.isShow()) {
                return
            }

            if (AdGlobal.startAdIsShow) {
                return
            }
            RewardedVideoWaterfall.inst.asyncShow().then((data) => {
                if (data.success) {
                    NetWorkManager.inst.uploadEventData('app_auto_start', EventType.Frequency)
                }
            })
        }
    }


    public homeViewShow() {
        if (AdGlobal.homeShowCount === 0) {
            NetWorkManager.inst.uploadEventData('app_launch', EventType.Frequency)
            let needPrivacyAlert = OpenAPIManager.inst.needPrivacyAlert()
            if ((AdGlobal.adType === ShowMoreAdType.NONE || AdGlobal.channel === 'NATURAL') && needPrivacyAlert) {
                let showed = OpenAPIManager.inst.showPrivacyAlert(!AdGlobal.forbidPrivacyDialog, true, (agree) => {
                    if (agree) {
                        this.homeViewShowAd()
                    }
                })
                if (!showed) {
                    this.privacyAlert.show((agree) => {
                        if (agree) {
                            this.homeViewShowAd()
                        }
                    })
                }
            } else {
                this.homeViewShowAd()
            }

        }
        AdGlobal.homeShowCount++
    }

    private homeViewShowAd = async () => {
        if (AdGlobal.adType === ShowMoreAdType.NONE) {
            return
        }

        let showAdCount = 0
        if (EnvUtils.OPPO() || EnvUtils.VIVO() || EnvUtils.RONGYAO()) {
            for (let index = 0; index < 100000; index++) {
                if (window["showStartVideoWillShow"] && !window["showStartVideoShowed"]) {
                    await AdUtils.timeOut(1000)
                    continue
                }

                if (AdGlobal.startAdIsShow) {
                    await AdUtils.timeOut(1000)
                    continue
                }

                if (EnvUtils.OPPO() && AdGlobal.adType == ShowMoreAdType.HIGH && showAdCount === 0) {
                    CustomAdManager.inst.asyncShow(null, CustomAdManager.inst.bottomAdStyle())
                    await AdUtils.timeOut(AdGlobal.adShowLoopTimeout)
                }

                if (AdGlobal.adType == ShowMoreAdType.LOW) {
                    await CustomAdManager.inst.asyncShow(null, CustomAdManager.inst.normalAdStyle())
                    await AdUtils.timeOut(AdGlobal.adShowLoopTimeout * 1.5)
                }

                if (AdGlobal.adType == ShowMoreAdType.MIDDLE || AdGlobal.adType == ShowMoreAdType.HIGH) {
                    if (showAdCount === 2 || showAdCount === 5 || showAdCount === 10) {
                        await this.clickShowAdNode.asyncShow("加满黄金，畅玩游戏！")
                    } else {
                        if (EnvUtils.VIVO()) {
                            await CustomAdManager.inst.asyncShow(null, CustomAdManager.inst.normalAdStyle())
                        }else{
                            await RewardedVideoAdManager.inst.asyncShow()
                        }
                    }
                    await AdUtils.timeOut(AdGlobal.adShowLoopTimeout)
                }
                showAdCount++
            }
        }
    }

    public showPrivacyAlert() {
        if (!OpenAPIManager.inst.showPrivacyAlert(true, false)) {
            this.privacyAlert.show(()=>{}, true)
        }
    }

    // 处理游戏页面
    public gameViewShow() {
        // Home and level share Main; hide home-only full-screen dims so they cannot veil the stage.
        if (this.clickShowAdNode?.isValid) this.clickShowAdNode.node.active = false
        if (this.privacyAlert?.isValid) this.privacyAlert.node.active = false
        NetWorkManager.inst.uploadEventData('app_game_show', EventType.Frequency)
        AdGlobal.gameShowCount++
    }

    public pageViewShow() {

    }

    public resultViewShow() {
        if (AdGlobal.resultShowCount === 0) {
            NetWorkManager.inst.uploadEventData('app_result_show', EventType.Frequency)
        }
        if (AdGlobal.adType === ShowMoreAdType.NONE) {
            CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => { 
                this.checkGameAgain(AdGlobal.resultShowCount)
            })
        }else{
            if (AdGlobal.adType == ShowMoreAdType.MIDDLE || AdGlobal.adType == ShowMoreAdType.HIGH) {
                this.showMoreRewardedAdHigh(1)
            }
            this.checkGameAgain(AdGlobal.resultShowCount)
        }
        AdGlobal.resultShowCount++;
    }

    private checkGameAgain = (resultShowCount: number) => {
        if (resultShowCount === 1) {
            NetWorkManager.inst.uploadEventData('app_result_show_again', EventType.Frequency)
            OpenAPIManager.inst.installShortcut((success) => {
                if (success) {
                    NetWorkManager.inst.uploadEventData('add_shortcut', EventType.Frequency)
                }
            })
        }
    }
}


