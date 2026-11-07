import { AdGlobal } from "../dispose/AdGlobal";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { NativeOptions } from "../platform/Native/NativeHybridAdManager";
import { AdSpaceType, AdUtils } from "../utils/AdUtils";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";

export class BannerAdManager {
    private static _inst: BannerAdManager;
    public static get inst(): BannerAdManager {
        if (this._inst == null) {
            this._inst = new BannerAdManager();
        }
        return this._inst;
    }

    private bannerAdData: any = {}

    topStyle = () => {
        let screenSize = OpenAPIManager.inst.getScreenSize()
        if (!screenSize) {
            return
        }
        return { top: 180, left: 0, width: screenSize.width, }
    }

    bottom2Style = () => {
        let screenSize = OpenAPIManager.inst.getScreenSize()
        if (!screenSize) {
            return
        }
        return { top: screenSize.height - 300, left: 0, width: screenSize.width, }
    }

    hideAll = () => {
        for (let key in this.bannerAdData) {
            this.hide(key as AdUnitIdKey)
        }
    }

    hide = (subkey: AdUnitIdKey) => {
        let bannerAd = this.bannerAdData[subkey]
        if (!bannerAd) {
            return false
        }
        this.clean(subkey)
        return true
    }

    show = async (subkey: AdUnitIdKey, style?: { left?: number; top?: number; width?: number; height?: number; }, options?: NativeOptions) => {
        if (!options) {
            options = {} as NativeOptions
            options.autoBack = false
            options.autoClick = false
        }

        if (!OpenAPIManager.inst.adUsable()) {
            return
        }

        AdGlobal.canLog && console.log('[BannerAdManager] 广告展请求', subkey)
        NetWorkManager.inst.uploadEventData('ad_request_' + AdSpaceType.Banner, EventType.Frequency)

        let bannerAd = this.bannerAdData[subkey]

        if (bannerAd) {
            let cleanResult = this.hide(subkey)
            if (cleanResult) {
                await AdUtils.timeOut(500)
            }
        }

        let adId = OpenAPIManager.inst.getAdUnitId(subkey)
        if (!adId) {
            return
        }

        if (EnvUtils.HUAWEI() && !style) {
            let screenSize = OpenAPIManager.inst.getScreenSize()
            style = { top: screenSize.height - 57, left: 0, height: 57, width: screenSize.width }
        }

        if (EnvUtils.XIAOMI() && !style) {
            style = { left: 0 }
        }

        bannerAd = OpenAPIManager.inst.createBannerAd(adId, 0, style)
        if (!bannerAd) {
            return
        }

        bannerAd.onError((res: any) => {
            AdGlobal.canLog && console.error('[BannerAdManager] 广告失败 error:', subkey, JSON.stringify(res))
            let errMsg = res.errMsg
            let errCode = res.errCode
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.Banner, EventType.Frequency, 0, { errCode: errCode, errMsg: errMsg})
            NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: Banner brand: ${AdGlobal.brand} subKey: ${subkey} adId:${adId} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
        })

        if (bannerAd.onClose) {
            bannerAd.onClose(()=>{
                AdGlobal.canLog && console.log('[BannerAdManager] 广告关闭', subkey)
            })
        }

        if (bannerAd.onClick) {
            bannerAd.onClick(()=>{
                AdGlobal.canLog && console.log('[BannerAdManager] 广告点击', subkey)
                NetWorkManager.inst.uploadEventData('ad_click_' + AdSpaceType.Banner, EventType.Frequency)
            })
        }

        bannerAd.onLoad((data) => {
            let ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.Banner)
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

            NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.Banner, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.Banner , EventType.Number, ecpm)
            AdGlobal.canLog && console.log('[BannerAdManager] 广告加载成功：', subkey, adId, ecpm, JSON.stringify(data))
        })
        
        this.bannerAdData[subkey] = bannerAd
        if (EnvUtils.ANDROID()){
            bannerAd.show(options).then((data) => {
                AdGlobal.canLog && console.log('[BannerAdManager] 广告展示成功：', subkey, adId, JSON.stringify(data))
            })
        }else{
            bannerAd.show()
        }
        
    }

    clean = (subkey: AdUnitIdKey) => {
        let bannerAd = this.bannerAdData[subkey]
        if (!bannerAd) {
            return
        }
        bannerAd.hide()
        bannerAd.destroy()
        this.bannerAdData[subkey] = null
    }
}