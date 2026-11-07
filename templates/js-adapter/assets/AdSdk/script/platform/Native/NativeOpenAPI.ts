import { AdUnitIdKey, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from "../Base/BaseOpenAPI";
import { NativeHybridManager } from "./NativeHybridManager";
import { NativeHybridAdManager, NativeHybridAdType } from "./NativeHybridAdManager";
import { Size } from "cc";
import { AdGlobal } from "../../dispose/AdGlobal";

export class NativeOpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
        this.hybridManager.request('vibrate', { long }, (success, data) => {})
    }

    private hybridManager: NativeHybridManager = new NativeHybridManager()

    init = () => {
        this.hybridManager.initCallbackMonitor()
    }

    uploadAdConfig = async (config: any) => {
        return new Promise<Boolean>(async (resolve) => {
            this.hybridManager.request('uploadAdConfig', config, (success, data) => {
                if (success) {
                    resolve(true)
                } else {
                    resolve(false)
                }
            }, null, false)
        })
    }

    needPrivacyAlert(): boolean {
        return true
    }

    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return null
    }

    registerEvent = (key: string, event: ((data: any) => void)) => {
        this.hybridManager.registerEvent(key, event)
    }

    onHide(listener: OnHideListener) {
        this.hybridManager.registerEvent("AppOnHide", ()=>{
            if (listener) {
                listener()
            }
        })
    }

    exitApplication(data: any) {
        this.hybridManager.request('exitApplication', data, (success, data) => {

        })
    }

    showShare(): boolean {
        return false
    }

    installShortcut(callback: (success: any) => void): void {

    }

    onShareTimeline(listener: () => ShareAppMessageRequest) {

    }

    onShareAppMessage(listener: () => ShareAppMessageRequest) {

    }

    showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {

    }
    createNativeAd(adUnitId: string, style?: any) {
        
    }

    shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
        this.hybridManager.request('shareAppMessage', shareAppMessage, (success, data) => {
            if (callback) {
                callback({ success: success, erorrMsg: null })
            }
        }, null, false)
    }

    toTempFilePathSync(data: any): string {
        return null
    }

    toTempFilePathAsync(data: any, callBack: (path: string) => void): void {
        callBack(null)
    }

    getCanvesSize(): Size {
        return null
    }

    onShow(listener: OnShowListener) {
        this.hybridManager.registerEvent("AppOnShow", (data)=>{
            if (listener) {
                let launchData = {} as LaunchData
                launchData.query = data.query
                listener(launchData)
            }
        })
    }

    getLaunchOptionsSync(): LaunchData {
        return null
    }

    getLaunchOptionsAsync(): Promise<LaunchData> {
        return new Promise<LaunchData>(async (resolve) => {
            this.hybridManager.request('getLaunchOptionsAsync', {}, (success, data) => {
                if (success) {
                    let launchData = {} as LaunchData
                    launchData.query = data
                    resolve(launchData)
                } else {
                    resolve(null)
                }
            }, null, false)
        })
    }


    adUsable() {
        return true
    }

    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?:((agree: boolean)=> void)) {
        if (showView) {
            this.hybridManager.request('showPrivacyAlert', { checkShowed: checkShowed }, (success, data) => { 
                if (callBack) {
                    callBack(data?.agree ?? false)
                }
            }, null, false)
            return true
        }else{
            if (callBack) {
                callBack(true)
            }
            return true
        }
    }

    async login(): Promise<LoginData> {
        return new Promise<LoginData>(async (resolve) => {
            this.hybridManager.request('login', {}, (success, data) => {
                let loginData = {} as LoginData
                if (success && data && data.success) {
                    loginData.success = true
                } else {
                    loginData.success = false
                }
                resolve(loginData)
            }, null, false)
        })
    }

    createScreenAd(adUnitId: string, subKey?: string) {
        let hybridAdManager = new NativeHybridAdManager()
        hybridAdManager.init(this.hybridManager, NativeHybridAdType.StartScreen, adUnitId)
        return hybridAdManager
    }

    createRewardedVideoAd(adUnitId: string, multiton: boolean) {
        let hybridAdManager = new NativeHybridAdManager()
        hybridAdManager.init(this.hybridManager, NativeHybridAdType.RewardedVideo, adUnitId)
        return hybridAdManager
    }

    createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }) {
        let hybridAdManager = new NativeHybridAdManager()
        hybridAdManager.init(this.hybridManager, NativeHybridAdType.Banner, adUnitId)
        return hybridAdManager
    }

    createInterstitialAd(adUnitId: string) {
        let hybridAdManager = new NativeHybridAdManager()
        let hybridAdType = NativeHybridAdType.Interstitial
        hybridAdManager.init(this.hybridManager, hybridAdType, adUnitId)
        return hybridAdManager
    }

    createCustomAd(adUnitId: string, style: any, subKey?: string) {
        let hybridAdManager = new NativeHybridAdManager()
        let hybridAdType = NativeHybridAdType.CustomAd
        hybridAdManager.init(this.hybridManager, hybridAdType, adUnitId, style)
        return hybridAdManager
    }

    createGamePortalAd(adUnitId: string, multiton: boolean) {
        let hybridAdManager = new NativeHybridAdManager()
        let hybridAdType = NativeHybridAdType.GamePortal
        hybridAdManager.init(this.hybridManager, hybridAdType, adUnitId)
        return hybridAdManager
    }

    createOriginalAd(adUnitId: string, subKey: string) {
        let hybridAdManager = new NativeHybridAdManager()
        let hybridAdType = NativeHybridAdType.OriginalAd
        hybridAdManager.init(this.hybridManager, hybridAdType, adUnitId)
        return hybridAdManager
    }

    getAdUnitId(key: AdUnitIdKey) {
        let adId = AdGlobal.getAdUnitId(key)
        if (adId) {
            return adId
        }
    
        return "000000"
    }

    setStorage(key: string, data: string, encrypt: boolean, callback: (success: boolean) => void) {
        this.hybridManager.request('setStorage', { key: key, data: data, encrypt: encrypt }, (success, data) => {
            if (callback) {
                callback(success)
            }
        })
    }
    getStorage(key: string, encrypt: boolean, callback: (success: boolean, data: any) => void) {
        this.hybridManager.request('getStorage', { key: key, encrypt: encrypt }, (success, data) => {
            if (callback) {
                callback(success, data)
            }
        })
    }

    async getSystemInfo(): Promise<SystemInfo> {

        return new Promise<SystemInfo>(async (resolve) => {
            this.hybridManager.request('getSystemInfo', {}, (success, data) => {
                let info = data as SystemInfo
                info.companyKey = 'SJCX'
                if (success) {
                    resolve(info)
                } else {
                    resolve(null)
                }
            }, null, false)
        })
    }

    getScreenSize(): { width: number; height: number; } {
        return { width: 0, height: 0 }
    }

    showModal(title: string, content: string, confirmText: string, showCancel: boolean, cancelText: string, success: (res: any) => void) {

    }

    showToast(text: string, icon?: "success" | "error" | "loading" | "none") {
        this.hybridManager.request('showToast', { text: text, icon: icon }, (success, data) => { })
    }

    shortcutInstalled(message: string, callback: (success: boolean, code: number) => void) {

    }

    request(data: { url: string; data?: any; header?: any; timeout?: number; method?: "POST" | "GET"; dataType?: "json"; success?: (res: any) => void; fail?: (res: any) => void; }) {
        var oReq = new XMLHttpRequest();
        oReq.addEventListener("load", (res) => {
            if (oReq.status === 200) {
                let jsonData = JSON.parse(oReq.responseText)
                if (data.success) {
                    data.success({ success: true, data: jsonData })
                }
            } else {
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
            }
        });
        oReq.addEventListener("error", (res) => {
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        });

        oReq.addEventListener("abort", (res) => {
            if (data.success) {
                data.success({ success: false, data: null })
            }
        });

        oReq.open(data.method, data.url);
        if (data.header) {
            for (let key in data.header) {
                let value = data.header[key]
                oReq.setRequestHeader(key, value)
            }
        }

        if (data.data && data.header && data.header['content-type']?.includes('application/x-www-form-urlencoded')) {
            data.data = Object.keys(data.data).map(function (key) {
                return encodeURIComponent(key) + "=" + encodeURIComponent(data.data[key]);
            }).join("&");
        }

        if (data.data && data.header && data.header['content-type']?.includes('application/json')) {
            data.data = JSON.stringify(data.data)
        }
        oReq.send(data.data);
    }

    navigateToMiniProgram(appid: string) {

    }

    openUrl(url: string) {
        this.hybridManager.request('loadUrl', { url: url }, (success, data) => { })
    }

    uploadPageOpenEvent(pageName: string){
        this.hybridManager.request('uploadPageOpenEvent', { pageName: pageName }, (success, data) => { })
    }
}
