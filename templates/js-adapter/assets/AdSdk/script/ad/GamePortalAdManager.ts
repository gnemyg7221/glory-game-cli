import { AdGlobal } from "../dispose/AdGlobal";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { AdSpaceType, AdUtils } from "../utils/AdUtils";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";

export class GamePortalAdManager{
    private static _inst: GamePortalAdManager;
    public static get inst(): GamePortalAdManager {
        if (this._inst == null) {
            this._inst = new GamePortalAdManager();
        }
        return this._inst;
    }

    private gamePortalAd = null
    private onError = null
    private onClose = null
    private callback = null
    private onLoad = null
    private isEnded = false

    show = (subkey: AdUnitIdKey, callback:(success: boolean, isEnded: boolean) => void) => {
        
        NetWorkManager.inst.uploadEventData('ad_request_' + AdSpaceType.GamePortal, EventType.Frequency)

        // 清理事件
        this.clean()
        this.callback = callback
        
        if (!OpenAPIManager.inst.adUsable()) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.GamePortal, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'radUsable is false'  + `[类型: 格子 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(true, true)
            return
        }
        
        if (!subkey) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.GamePortal, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'subkey is null'  + `[类型: 格子 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        let adId = OpenAPIManager.inst.getAdUnitId(subkey);

        if (!adId) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.GamePortal, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'gamePortalAd id is null'  + `[类型: 格子 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        let adUsable = AdUtils.adShowTimeCheck(adId)
        if (!adUsable) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.GamePortal, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'gamePortalAd adShowTimeCheck error'  + `[类型: 格子 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            AdGlobal.canLog && console.error(adId, '重复请求 ', -1035)
            this.callbackResult(false, false)
            return
        }
        AdUtils.setAdShowTime(adId)

        this.gamePortalAd = OpenAPIManager.inst.createGamePortalAd(adId, false)
        
        if (!this.gamePortalAd) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.GamePortal, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'gamePortalAd error'  + `[类型: 格子 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        this.onError = (res) => {
            AdGlobal.canLog && console.error('[GamePortalAdManager]:九宫格 广告显示error', adId, res)
            let errMsg = res.errMsg
            let errCode = res.errCode

            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.GamePortal, EventType.Frequency, 0 , { errCode: errCode, errMsg: errMsg})
            NetWorkManager.inst.uploadErrorMsg(errCode, errMsg  + `[类型: 格子 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            
            this.callbackResult(false, false)
        }

        this.onClose = (res) => {
            AdGlobal.canLog && console.log('gamePortalAd onClose isEnded:', this.isEnded, subkey, AdUtils.adShowCount, AdUtils.rewardedCloseCount)
            this.callbackResult(true, true)
        }

        this.onLoad = async (data) => {
            let ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.GamePortal)
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

            this.gamePortalAd.show().then(function () {
                AdGlobal.canLog && console.log('this.gamePortalAd.show success:', ecpm)
                AdUtils.adShowCount++
                AdUtils.adIncome = AdUtils.adIncome + ecpm
                NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.GamePortal, EventType.Frequency)
                NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.GamePortal, EventType.Number, ecpm)
            })
        }

        this.gamePortalAd.onError(this.onError)
        this.gamePortalAd.onClose(this.onClose)
        this.gamePortalAd.onLoad(this.onLoad)
        this.gamePortalAd.load();
    }

    private clean = () => {
        if (this.gamePortalAd && this.onClose) {
            this.gamePortalAd.offClose(this.onClose)
            this.onClose = null
        }

        if (this.gamePortalAd && this.onError) {
            this.gamePortalAd.offError(this.onError)
            this.onError = null
        }

        if (this.gamePortalAd && this.onLoad) {
            this.gamePortalAd.offLoad(this.onLoad)
            this.onLoad = null
        }

        if (this.callback) {
            this.callback = null
        }
        if (this.gamePortalAd) {
            this.gamePortalAd.destroy()
        }
        this.gamePortalAd = null
        this.isEnded = false
    }

    private callbackResult = (success: boolean, isEnded: boolean) => {

        if (this.callback){
            this.callback(success, isEnded)
            this.callback = null
        }
        this.clean()
    }

}

