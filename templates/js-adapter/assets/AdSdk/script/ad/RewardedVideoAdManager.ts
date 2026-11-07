import { AdGlobal } from "../dispose/AdGlobal";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { NativeOptions } from "../platform/Native/NativeHybridAdManager";
import { AdSpaceType, AdUtils } from "../utils/AdUtils";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";


export const VideoAdKeyList = [AdUnitIdKey.Rewarded1, AdUnitIdKey.Rewarded2, AdUnitIdKey.Rewarded3, AdUnitIdKey.Rewarded4]
export enum PreVideoStatus {
    Init = 0,
    Wait = 1,
    Ready = 2,
    Showed = 3,
    Error = -1,
}
export class RewardedVideoAdManager {
    private static _inst: RewardedVideoAdManager;
    public static get inst(): RewardedVideoAdManager {
        if (this._inst == null) {
            this._inst = new RewardedVideoAdManager();
        }
        return this._inst;
    }

    public videoStatus: PreVideoStatus = PreVideoStatus.Init

    private getRewardedVideoAdCallback: ((rewardedVideoAd: any, needClean: boolean) => void) = null
    private rewardedVideoAd = null
    public currentEcpm = null
    public currentAdId = null
    public needEndPreload = true
    private onError = null
    private onClose = null
    private callback = null
    private onLoad = null
    private gameShowTimer = null
    private subkey: AdUnitIdKey = null

    isShow = () => {
        if (this.callback) {
            return true
        }

        return false
    }

    asyncShow = (subkey?: AdUnitIdKey, play: boolean = true) => {
        return new Promise<{ success: boolean, isEnded: boolean, needClean: boolean}>(async (resolve) => {
            this.show(subkey, (success, isEnded, needClean) => {
                resolve({ success: success, isEnded: isEnded, needClean: needClean})
            }, play)
        })
    }

    asyncPreloadAd = (subkey?: AdUnitIdKey) => {
        return new Promise<{ videoStatus: PreVideoStatus }>(async (resolve) => {
            this.preloadAd(subkey, (videoStatus) => {
                resolve({ videoStatus: videoStatus})
            })
        })
    }

    show = async (key: AdUnitIdKey, callback: (success: boolean, isEnded: boolean, needClean?: boolean) => void, play: boolean = true, options?: NativeOptions) => {
        AdGlobal.canLog && console.log('[RewardedVideoAdManager]:激励视频 广告请求：', key)
        if (!options) {
            options = {} as NativeOptions
            options.autoBack = false
            options.autoClick = false
        }

        if (this.callback) {
            setTimeout(() => {
                callback(false, false)
            }, 100);
            AdGlobal.canLog && console.error('[RewardedVideoAdManager]:同一时间只能展示一个激励视频')
            return
        }

        NetWorkManager.inst.uploadEventData('ad_request_' +  AdSpaceType.Rewarded, EventType.Frequency)

        // 清理事件
        if (this.gameShowTimer) {
            clearTimeout(this.gameShowTimer)
            this.gameShowTimer = null
        }

        this.callback = callback
        if (!OpenAPIManager.inst.adUsable()) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.Rewarded, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-1', 'radUsable is false' + `[类型: 激励 brand: ${AdGlobal.brand} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(true, true)
            return
        }
        this.getRewardedVideoAdCallback = (rewardedVideoAd: any, needClean: boolean) => {
            if (!rewardedVideoAd) {
                this.callbackResult(false, false, needClean)
                return
            }
            this.videoStatus = PreVideoStatus.Showed
            if (EnvUtils.HUAWEI()) {
                rewardedVideoAd.show()
                AdGlobal.canLog && console.log('rewardedVideoAd upload Ecpm:', this.currentEcpm)
                AdUtils.adShowCount++
                AdUtils.adIncome = AdUtils.adIncome + this.currentEcpm
                NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.Rewarded, EventType.Frequency)
                NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.Rewarded , EventType.Number, this.currentEcpm)
                this.currentEcpm = 0
            } else {
                rewardedVideoAd.show(options).then((result) => {
                    AdGlobal.canLog && console.log('[RewardedVideoAdManager]:激励视频 广告展示：', this.subkey, this.currentEcpm)
                    AdUtils.adShowCount++
                    AdUtils.adIncome = AdUtils.adIncome + this.currentEcpm
                    NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.Rewarded, EventType.Frequency)
                    NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.Rewarded , EventType.Number, this.currentEcpm)
                    this.currentEcpm = 0
                })
            }
        }

        this.preloadAd(key);
    }

    public preloadAd = (subkey?: AdUnitIdKey, preloadCallback?:(videoStatus: PreVideoStatus)=>void) => {

        if (this.videoStatus === PreVideoStatus.Wait) {
            preloadCallback && preloadCallback(this.videoStatus)
            return
        }

        if (this.videoStatus === PreVideoStatus.Ready) {
            if (this.getRewardedVideoAdCallback) {
                this.getRewardedVideoAdCallback(this.rewardedVideoAd, true)
            }
            preloadCallback && preloadCallback(this.videoStatus)
            return
        }
        this.videoStatus = PreVideoStatus.Wait
        if (!subkey) {
             subkey = VideoAdKeyList[Math.floor(Math.random() * VideoAdKeyList.length)]
        }
        this.subkey = subkey
        let adId = OpenAPIManager.inst.getAdUnitId(subkey);

        if (!adId) {
            AdGlobal.canLog && console.error('[RewardedVideoAdManager]:激励视频 adId不存在', subkey ,adId)
            NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.Rewarded, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-1', 'getRewardedVideoId is null' + `[类型: 激励 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.videoStatus = PreVideoStatus.Error
            if (this.getRewardedVideoAdCallback) {
                this.getRewardedVideoAdCallback(null, true)
            }
            preloadCallback && preloadCallback(this.videoStatus)
            return
        }
        this.currentAdId = adId
        this.rewardedVideoAd = OpenAPIManager.inst.createRewardedVideoAd(adId, false)
        if (!this.rewardedVideoAd) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.Rewarded, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-1', 'createRewardedVideoAd error' + `[类型: 激励 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.videoStatus = PreVideoStatus.Error
            if (this.getRewardedVideoAdCallback) {
                this.getRewardedVideoAdCallback(null, true)
            }
            preloadCallback && preloadCallback(this.videoStatus)
            return
        }

        this.onError = (res) => {
            AdGlobal.canLog && console.error('[RewardedVideoAdManager]:激励视频 广告显示error', subkey ,adId, res)
            let errMsg = res.errMsg
            let errCode = res.errCode

            // 这个错误直接复用试试
            if (EnvUtils.VIVO() && errMsg === '首帧未渲染或未点击屏幕，回调激励视频播放错误' && errCode === 1001) {
                this.videoStatus = PreVideoStatus.Ready
                if (this.getRewardedVideoAdCallback) {
                    this.getRewardedVideoAdCallback(null, false)
                }
                preloadCallback && preloadCallback(this.videoStatus)
                return
            }

            if (errCode === 1004) {
                // 风控
                NetWorkManager.inst.uploadEventData('ad_risk_error_' +  AdSpaceType.Rewarded, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 激励 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            } else if (errCode === 1003) {
                // 空
                NetWorkManager.inst.uploadEventData('ad_load_null_' +  AdSpaceType.Rewarded, EventType.Frequency)
            } else {
                // 异常
                NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.Rewarded, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 激励 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            }
            this.videoStatus = PreVideoStatus.Error
            if (this.getRewardedVideoAdCallback) {
                this.getRewardedVideoAdCallback(null, true)
            }
            preloadCallback && preloadCallback(this.videoStatus)
        }

        this.onClose = (res) => {
            AdGlobal.canLog && console.log('[RewardedVideoAdManager]:激励视频 广告关闭', subkey ,new Date().getTime(), res)
            this.callbackResult(true, res.isEnded)
            if (!res.isEnded) {
                AdUtils.rewardedCloseCount++
            }
        }

        if (EnvUtils.WECHAT()) {
            this.onLoad = (data) => {
                AdGlobal.canLog && console.log('this.rewardedVideoAd.load success:', data)
            }
            this.rewardedVideoAd.onError(this.onError)
            this.rewardedVideoAd.onClose(this.onClose)
            this.rewardedVideoAd.onLoad(this.onLoad)
            this.rewardedVideoAd.load().then((data) => {
                let ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.Rewarded)
                if (data && data.ECPM && data.ECPM.ECPMCode === 0 && data.ECPM.ECPMPrice > 0) {
                    let becpm = data.ECPM.ECPMPrice 
                    becpm = Math.round(becpm)
                    if (becpm < 1) {
                        becpm = 1
                    }
                    ecpm = becpm
                }

                this.currentEcpm = ecpm
                this.videoStatus = PreVideoStatus.Ready
                if (this.getRewardedVideoAdCallback) {
                    this.getRewardedVideoAdCallback(this.rewardedVideoAd, true)
                }
                preloadCallback && preloadCallback(this.videoStatus)
            });
        } else {
            this.onLoad = (data: any) => {
                let ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.Rewarded)

                if (EnvUtils.OPPO()) {
                    if (data && data.ECPM && data.ECPM.ECPMCode === 0 && data.ECPM.ECPMPrice > 0) {
                        let becpm = data.ECPM.ECPMPrice
                        becpm = Math.round(becpm)
                        if (becpm < 1) {
                            becpm = 1
                        }
                        ecpm = becpm
                    }
                }

                if (EnvUtils.VIVO()) {
                    if (data && data.price && data.price > 0) {
                        let becpm = data.price
                        becpm = Math.round(becpm)
                        if (becpm < 1) {
                            becpm = 1
                        }
                        ecpm = becpm
                    }
                }


                this.currentEcpm = ecpm
                this.videoStatus = PreVideoStatus.Ready
                AdGlobal.canLog && console.log('[RewardedVideoAdManager]:激励视频 加载成功：', subkey, adId, ecpm)
                if (this.getRewardedVideoAdCallback) {
                    this.getRewardedVideoAdCallback(this.rewardedVideoAd, true)
                }
                preloadCallback && preloadCallback(this.videoStatus)
            }
            this.rewardedVideoAd.onError(this.onError)
            this.rewardedVideoAd.onClose(this.onClose)
            this.rewardedVideoAd.onLoad(this.onLoad)
            this.rewardedVideoAd.load();

        }
    }

    public clean = () => {
        if (this.rewardedVideoAd && this.onClose) {
            this.rewardedVideoAd.offClose(this.onClose)
            this.onClose = null
        }

        if (this.rewardedVideoAd && this.onError) {
            this.rewardedVideoAd.offError(this.onError)
            this.onError = null
        }

        if (this.rewardedVideoAd && this.onLoad) {
            this.rewardedVideoAd.offLoad(this.onLoad)
            this.onLoad = null
        }

        if (this.callback) {
            this.callback = null
        }
        if (this.rewardedVideoAd) {
            this.rewardedVideoAd.destroy()
        }
        this.videoStatus = PreVideoStatus.Init
        this.rewardedVideoAd = null
        this.getRewardedVideoAdCallback = null
    }

    private callbackResult = (success: boolean, isEnded: boolean, needClean: boolean = true) => {
        if (this.callback) {
            this.callback(success, isEnded, needClean)
            this.callback = null
        }
        if (needClean) {
            this.clean()
            setTimeout(() => {
                if (this.needEndPreload) {
                    this.preloadAd()
                }
            }, 100);
        }
    }
}

