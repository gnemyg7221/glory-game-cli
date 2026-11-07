import { AdGlobal, ShowMoreAdType } from "../dispose/AdGlobal";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { NativeOptions } from "../platform/Native/NativeHybridAdManager";
import { AdSpaceType, AdUtils } from "../utils/AdUtils";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";

export const InterstitialAdList = [AdUnitIdKey.InterstitialAd1, AdUnitIdKey.InterstitialAd2, AdUnitIdKey.InterstitialAd3]

export class InterstitialAdManager {
    private static _inst: InterstitialAdManager;
    public static get inst(): InterstitialAdManager {
        if (this._inst == null) {
            this._inst = new InterstitialAdManager();
        }
        return this._inst;
    }

    private interstitialAd = null
    private onError = null
    private onClose = null
    private callback = null
    private onLoad = null
    private isEnded = false
    private currentKeyIndex = 0

    asyncShow = (subkey?: AdUnitIdKey) => {
        return new Promise<{ success: boolean, isEnded: boolean }>(async (resolve) => {
            this.show(subkey, (success, isEnded) => {
                resolve({ success: success, isEnded: isEnded })
            })
        })
    }

    show = async (subkey?: AdUnitIdKey, callback?: (success: boolean, isEnded: boolean) => void, options?: NativeOptions) => {
        AdGlobal.canLog && console.log('[InterstitialAdManager] 广告调用', subkey)
        if (!options) {
            options = {} as NativeOptions
            options.autoBack = false
            options.autoClick = false
        }

        // 清理事件
        let cleanResult = this.clean()
        if (cleanResult) {
            await AdUtils.timeOut(1000)
        }

        NetWorkManager.inst.uploadEventData('ad_request_' + AdSpaceType.Interstitial, EventType.Frequency)

        if (this.interstitialAd) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Interstitial, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'interstitialAd 重复展示' + `[类型: 插屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        this.callback = callback
        if (!OpenAPIManager.inst.adUsable()) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Interstitial, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'radUsable is false' + `[类型: 插屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(true, true)
            return
        }

        if (!subkey) {
            if (this.currentKeyIndex >= InterstitialAdList.length) {
                this.currentKeyIndex = 0
            }
            subkey = InterstitialAdList[this.currentKeyIndex]
            this.currentKeyIndex++
        }

        let adId = OpenAPIManager.inst.getAdUnitId(subkey);

        if (!adId) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Interstitial, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'interstitialAd id is null' + `[类型: 插屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        let adUsable = AdUtils.adShowTimeCheck(adId)
        if (!adUsable) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Interstitial, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'interstitialAd adShowTimeCheck error' + `[类型: 插屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            AdGlobal.canLog && console.error(adId, '重复请求 ', -1035)
            this.callbackResult(false, false)
            return
        }
        AdUtils.setAdShowTime(adId)


        this.interstitialAd = OpenAPIManager.inst.createInterstitialAd(adId)

        if (!this.interstitialAd) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Interstitial, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'interstitialAd error' + `[类型: 插屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        this.onError = (res) => {
            AdGlobal.canLog && console.error('[InterstitialAdManager] 广告显示error', adId, JSON.stringify(res))
            let errMsg = res.errMsg
            let errCode = res.errCode

            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Interstitial, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 插屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
        }

        this.onClose = (res) => {
            this.isEnded = true;
            this.callbackResult(true, this.isEnded)
        }

        this.onLoad = async (data) => {
            AdGlobal.canLog && console.log('[InterstitialAdManager] 广告加载成功', subkey, adId)
            let ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.Interstitial)
            if (EnvUtils.VIVO()) {
                if (data && data.price && data.price > 0) {
                    let becpm = data.price
                    becpm = Math.round(becpm)
                    if (becpm < 1) {
                        becpm = 1
                    }
                    ecpm = becpm
                }
                AdUtils.adShowCount++
                AdUtils.adIncome = AdUtils.adIncome + ecpm
                NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.Interstitial, EventType.Frequency)
                NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.Interstitial, EventType.Number, ecpm)
            }

            if (EnvUtils.OPPO()) {
                if (data && data.ECPM && data.ECPM.ECPMCode === 0 && data.ECPM.ECPMPrice > 0) {
                    let becpm = data.ECPM.ECPMPrice
                    becpm = Math.round(becpm)
                    if (becpm < 1) {
                        becpm = 1
                    }
                    ecpm = becpm
                }

                this.interstitialAd.show(options).then((data) => {
                    AdGlobal.canLog && console.log('[InterstitialAdManager] 广告展示成功', subkey, adId, ecpm)
                    if (EnvUtils.ANDROID() && data && data.code === -1) {
                        return
                    }

                    AdUtils.adShowCount++
                    AdUtils.adIncome = AdUtils.adIncome + ecpm
                    NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.Interstitial, EventType.Frequency)
                    NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.Interstitial, EventType.Number, ecpm)
                })
            }
        }

        this.interstitialAd.onError(this.onError)
        this.interstitialAd.onClose(this.onClose)
        this.interstitialAd.onLoad(this.onLoad)
        if (EnvUtils.OPPO()) {
            this.interstitialAd.load()
        }

        if (EnvUtils.VIVO()) {
            this.interstitialAd.show(options).then((data) => {
                AdGlobal.canLog && console.log('[InterstitialAdManager] 广告展示成功', subkey, adId)
            })
        }

        if (EnvUtils.WECHAT()) {
            this.interstitialAd.show(options).then(() => {
                AdGlobal.canLog && console.log('[InterstitialAdManager] 广告展示成功', subkey, adId)
            }).catch((res) => {
                this.onError?.(res)
            })
        }
    }

    public clean = () => {
        if (!this.interstitialAd) {
            return false
        }

        if (this.interstitialAd && this.onError) {
            this.interstitialAd.offError(this.onError)
            this.onError = null
        }

        if (this.interstitialAd && this.onClose) {
            this.interstitialAd.offClose(this.onClose)
            this.onClose = null
        }

        if (this.interstitialAd && this.onLoad) {
            this.interstitialAd.offLoad(this.onLoad)
            this.onLoad = null
        }

        if (this.interstitialAd && this.interstitialAd.hide) {
            this.interstitialAd.hide()
        }

        if (this.interstitialAd && this.interstitialAd.destroy) {
            this.interstitialAd.destroy()
        }

        if (this.callback) {
            this.callback = null
        }

        this.interstitialAd = null
        this.isEnded = false
        AdGlobal.canLog && console.log('[InterstitialAdManager] 广告清理成功')
        return true
    }

    private callbackResult = (success: boolean, isEnded: boolean) => {

        if (this.callback) {
            this.callback(success, isEnded)
            this.callback = null
        }
        this.clean()
    }

}

