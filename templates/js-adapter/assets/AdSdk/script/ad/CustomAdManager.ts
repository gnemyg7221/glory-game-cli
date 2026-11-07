import { Node, screen, Size, UITransform, view } from "cc";
import { AdGlobal } from "../dispose/AdGlobal";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { NativeOptions } from "../platform/Native/NativeHybridAdManager";
import { AdSpaceType, AdUtils } from "../utils/AdUtils";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";

export const CustomAdKeyList = [AdUnitIdKey.CustomTemplateAd1, AdUnitIdKey.CustomTemplateAd2, AdUnitIdKey.CustomTemplateAd3, AdUnitIdKey.CustomTemplateAd4]

export class CustomAdManager {
    private static _inst: CustomAdManager;
    public static get inst(): CustomAdManager {
        if (this._inst == null) {
            this._inst = new CustomAdManager();
        }
        return this._inst;
    }

    private customAd = null
    private onError = null
    private onHide = null
    private onClick = null
    private onClose = null
    private callback = null
    private onLoad = null
    private isEnded = false
    private adClick = false
    private currentKeyIndex = 0

    normalAdStyle = () => {

        if (EnvUtils.RONGYAO()) {
            return { gravity: "center_horizontal|center_vertical"}
        }

        let size = OpenAPIManager.inst.getScreenSize()
        if (!size) {
            return null
        }
        let width = size.width
        let height = size.height
        return { top: height / 2 - 370, left: 50, width: width - 100 }
    }

    bottomAdStyle = () => {
        return {}
    }

    topAdStyle = () => {
        let size = OpenAPIManager.inst.getScreenSize()
        if (!size) {
            return null
        }
        let width = size.width
        return { top: 0, left: 0, width: width }
    }

    btnStyle = (node: Node) => {
        let btnMT = 0
        let btnML = 0
        let btnW = 0
        let btnH = 0
        if (node) {
            let screenSizeOne = view.getVisibleSize()
            let screenSizeTwo = view.getVisibleSizeInPixel()
            let frameWidth = screen.windowSize.width / screen.devicePixelRatio
            let frameHeight = screen.windowSize.height / screen.devicePixelRatio
            let screenSizeThree = new Size(frameWidth, frameHeight)
            let scale = screenSizeTwo.width / screenSizeOne.width
            let worldPosition = node.parent.getComponent(UITransform).convertToWorldSpaceAR(node.position);
            let visibleOrigin = view.getVisibleOrigin();
            worldPosition.x = worldPosition.x + visibleOrigin.x
            worldPosition.y = worldPosition.y + visibleOrigin.y
            btnW = node.getComponent(UITransform).width * scale
            btnH = node.getComponent(UITransform).height * scale

            btnMT = screenSizeTwo.height - (worldPosition.y) * scale + (screenSizeThree.height - screenSizeTwo.height) / 2 - btnH / 2
            btnML = (worldPosition.x) * scale - btnW / 2
        } 

        if (btnMT < 0) {
            btnMT = 0
        }

        if (btnML < 0) {
            btnML = 0
        }

        return { width: btnW, height: btnH, left: btnML, top: btnMT }
    }

    isShow = () => {
        return !!this.customAd
    }

    isClick = () => {
        return this.adClick
    }

    asyncShow = (subkey?: AdUnitIdKey, style?: any,  options?: NativeOptions) => {
        return new Promise<{ success: boolean, isEnded: boolean }>(async (resolve) => {
            this.show(subkey, (success, isEnded) => {
                resolve({ success: success, isEnded: isEnded })
            }, style, options)
        })
    }

    show = async (subkey?: AdUnitIdKey, callback?: (success: boolean, isEnded: boolean) => void, style?: any, options?: NativeOptions) => {
        
        AdGlobal.canLog && console.log('[CustomAdManager]:原生广告 请求：', subkey)
        NetWorkManager.inst.uploadEventData('ad_request_' + AdSpaceType.CustomAd, EventType.Frequency)

        // 清理事件
        let cleanResult = this.callbackResult(false, false)
        if (cleanResult) {
            await AdUtils.timeOut(500)
        }

        this.callback = callback
        if (!OpenAPIManager.inst.adUsable()) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.CustomAd, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'radUsable is false' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(true, true)
            return
        }

        if (!subkey) {
            if (this.currentKeyIndex >= CustomAdKeyList.length) {
                this.currentKeyIndex = 0
            }
            subkey = CustomAdKeyList[this.currentKeyIndex]
            this.currentKeyIndex++
        }

        let adId = OpenAPIManager.inst.getAdUnitId(subkey);

        if (!adId) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.CustomAd, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'customAd id is null' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        let adUsable = AdUtils.adShowTimeCheck(adId)
        if (!adUsable) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.CustomAd, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'customAd adShowTimeCheck error' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            AdGlobal.canLog && console.error(adId, '重复请求 ', -1035)
            this.callbackResult(false, false)
            return
        }
        AdUtils.setAdShowTime(adId)

        if (!style) {
            style = this.normalAdStyle()
        }

        this.customAd = OpenAPIManager.inst.createCustomAd(adId, style)

        if (!this.customAd) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.CustomAd, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-3', 'customAd error' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            this.callbackResult(false, false)
            return
        }

        this.onError = (res) => {
            let errMsg = res.errMsg
            let errCode = res.errCode

            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.CustomAd, EventType.Frequency, 0 , { errCode: errCode, errMsg: errMsg})
            NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} adId:${adId} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            AdGlobal.canLog && console.error('[CustomAdManager]:原生广告 error', adId, res)
            this.callbackResult(false, false)
        }

        this.onClick = () => {
            NetWorkManager.inst.uploadEventData('ad_click_' + AdSpaceType.CustomAd, EventType.Frequency)
            AdGlobal.canLog && console.log('[CustomAdManager]:原生广告 点击成功：', subkey, adId)
            this.adClick = true
            setTimeout(() => {
                this.adClick = false
            }, 2000);
        }

        this.onClose = () => {
            this.isEnded = true;
            this.callbackResult(true, this.isEnded)
            AdGlobal.canLog && console.log('[CustomAdManager]:原生广告 关闭成功：', subkey, adId)
        }

        this.onHide = (res) => {
            this.isEnded = true;
            this.callbackResult(true, this.isEnded)
            AdGlobal.canLog && console.log('[CustomAdManager]:原生广告 关闭成功：', subkey, adId)
        }

        this.onLoad = async (data) => {
            let ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.CustomAd)
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
            NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.CustomAd, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.CustomAd, EventType.Number, ecpm)
            AdGlobal.canLog && console.log('[CustomAdManager]:原生广告 加载成功：', subkey, adId, ecpm, data)
        }
        if (this.customAd?.onError) {
            this.customAd?.onError(this.onError)
        }
        if (this.customAd?.onHide) {
            this.customAd?.onHide(this.onHide)
        }
        if (this.customAd?.onClose) {
            this.customAd?.onClose(this.onClose)
        }
        if (this.customAd?.onLoad) {
            this.customAd?.onLoad(this.onLoad)
        }
        if (this.customAd?.onClick) {
            this.customAd?.onClick(this.onClick)
        }
        this.customAd.show(options).then(() => { 
            AdGlobal.canLog && console.log('[CustomAdManager]:原生广告 展示成功：', subkey, adId)
        })
    }

    public clean = () => {
        if (!this.customAd) {
            return false
        }

        if (this.customAd && this.onHide) {
            this.customAd.offHide(this.onHide)
            this.onHide = null
        }

        if (this.customAd && this.onError) {
            this.customAd.offError(this.onError)
            this.onError = null
        }

        if (this.customAd && this.onLoad) {
            this.customAd.offLoad(this.onLoad)
            this.onLoad = null
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
        return this.clean()
    }

}

