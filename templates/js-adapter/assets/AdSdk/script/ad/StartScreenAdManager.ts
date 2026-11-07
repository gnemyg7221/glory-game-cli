
import { AdGlobal } from "../dispose/AdGlobal";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { NativeOptions } from "../platform/Native/NativeHybridAdManager";
import { AdSpaceType, AdUtils } from "../utils/AdUtils";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";


export class StartScreenAdManager {
    private static _inst: StartScreenAdManager;
    public static get inst(): StartScreenAdManager {
        if (this._inst == null) {
            this._inst = new StartScreenAdManager();
        }
        return this._inst;
    }

    private customAd = null
    private onError = null
    private onClose = null
    private onClick = null
    private callback = null
    private onLoad = null
    private isEnded = false

    normalAdStyle = () => {
        let size = OpenAPIManager.inst.getScreenSize()
        if (!size) {
            return null
        }
        let width = size.width
        let height = size.height
        return { top: height / 2 - 100, left: 50, width: width - 100 }
    }

    bottomAdStyle = () => {
        let size = OpenAPIManager.inst.getScreenSize()
        if (!size) {
            return null
        }
        let width = size.width
        let height = size.height
        return { top: height - 300, left: 30, width: width - 60 }
    }

    show = async (adKey: string, subkey: AdUnitIdKey, callback: (success: boolean, isEnded: boolean) => void, options?: NativeOptions) => {

        AdGlobal.canLog && console.log('[StartScreenAdManager] 广告展示', adKey, subkey, options)
        NetWorkManager.inst.uploadEventData('ad_request_' + AdSpaceType.StartScreen, EventType.Frequency)
        // 清理事件
        let cleanResult = this.clean()
        if (cleanResult) {
            await AdUtils.timeOut(500)
        }
        this.callback = callback
        if (!OpenAPIManager.inst.adUsable()) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.StartScreen, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'radUsable is false' + `[类型: 开屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(true, true)
            return
        }

        if (!adKey || !subkey) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.StartScreen, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'adKey is null' + `[类型: 开屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        let adId = OpenAPIManager.inst.getAdUnitId(subkey);

        if (!adId) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.StartScreen, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'customAd id is null' + `[类型: 开屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        let adUsable = AdUtils.adShowTimeCheck(adId)
        if (!adUsable) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.StartScreen, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'customAd adShowTimeCheck error' + `[类型: 开屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            AdGlobal.canLog && console.error(adId, '重复请求 ', -1035)
            this.callbackResult(false, false)
            return
        }
        AdUtils.setAdShowTime(adId)


        this.customAd = OpenAPIManager.inst.createScreenAd(adId)

        if (!this.customAd) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.StartScreen, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'customAd error' + `[类型: 开屏 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        this.onError = (res) => {
            AdGlobal.canLog && console.error('[StartScreenAdManager] 广告错误', adId, res)
            let errMsg = res.errMsg
            let errCode = res.errCode

            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.StartScreen, EventType.Frequency, 0 , { errCode: errCode, errMsg: errMsg})
            NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 开屏 brand: ${AdGlobal.brand} subKey: ${subkey} adId:${adId} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            
            this.callbackResult(false, false)
        }

        this.onClose = (data) => {
            this.isEnded = data.isEnded;
            this.callbackResult(true, this.isEnded)
            AdGlobal.canLog && console.log('[StartScreenAdManager] 广告关闭', adKey, subkey, adId)
        }

        this.onClick = () => {
            NetWorkManager.inst.uploadEventData('ad_click_' + AdSpaceType.StartScreen, EventType.Frequency)
            AdGlobal.canLog && console.log('[StartScreenAdManager] 广告点击', adKey, subkey, adId)
        }

        this.onLoad = async (data) => {

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

            AdUtils.adShowCount++
            AdUtils.adIncome = AdUtils.adIncome + ecpm
            NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.StartScreen, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.StartScreen, EventType.Number, ecpm)
            AdGlobal.canLog && console.log('[StartScreenAdManager] 广告加载', adKey, subkey, adId, JSON.stringify(data))

        }

        this.customAd.onError(this.onError)
        this.customAd.onLoad(this.onLoad)
        this.customAd.onClick(this.onClick)
        this.customAd.onClose(this.onClose)
        this.customAd.show(options).then((data) => {
            AdGlobal.canLog && console.log('[StartScreenAdManager] 广告展示', adKey, subkey, adId, JSON.stringify(data))
        })
    }

    public clean = () => {
        if (!this.customAd) {
            return false
        }

        if (this.customAd && this.onError) {
            this.customAd.offError(this.onError)
            this.onError = null
        }

        if (this.customAd && this.onLoad) {
            this.customAd.offLoad(this.onLoad)
            this.onLoad = null
        }
        if (this.customAd && this.onClick) {
            this.customAd.offClick(this.onClick)
            this.onClick = null
        }
        if (this.customAd && this.onClose) {
            this.customAd.offClose(this.onClose)
            this.onClose = null
        }

        if (this.callback) {
            this.callback = null
        }

        if (this.customAd) {
            this.customAd.hide()
        }

        if (this.customAd) {
            this.customAd.destroy()
        }

        this.customAd = null
        this.isEnded = false

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

