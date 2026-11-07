import { Size } from "cc";
import { AdUnitIdKey, AuthorityResponse, AuthorizeResponse, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from "../Base/BaseOpenAPI";

export class H5OpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
    
    }
    needPrivacyAlert(): boolean {
        return true
    }
    createScreenAd(adUnitId: string) {
        
    }
    createNativeAd(adUnitId: string, style?: any) {
        
    }
    openUrl(uri: string): void {
        
    }
    login(): Promise<LoginData> {
        return null
    }
    toTempFilePathSync(data: any): string {
        return null
    }
    toTempFilePathAsync(data: any, callBack: ((path: string) => void)): void {
        return null
    }
    getCanvesSize(): Size {
        return null
    }
    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return null
    }
    showShare(): boolean {
        return false
    }
    showPrivacy(): boolean {
        return true
    }
    installShortcut(callback: (success: any) => void): void {
       
    }
    
    createRewardedVideoAd(adUnitId: string, multiton: boolean) {
        
    }
    createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }) {
        
    }
    createInterstitialAd(adUnitId: string) {
        
    }
    exitApplication(data: any) {
        
    }
    shortcutHasInstalled(callback: (installed: boolean) => void) {
        
    }

    getGameConfig(callback: (gameConfig: any) => void) {
        if (callback) {
            callback(null)
        }
    }

    onShareTimeline(listener: () => ShareAppMessageRequest) {
        
    }
    onShareAppMessage(listener: () => ShareAppMessageRequest) {
        
    }
    showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {
       
    }
    shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
    }
    
    onShow(listener: OnShowListener) {
        
    }
    getLaunchOptionsSync(): LaunchData {
        return null
    }
    
    adUsable() {
        return false
    }
    
    createOriginalAd(adUnitId: string) {

    }
    getAdUnitId(key: AdUnitIdKey) {
        
    }
    setStorage(key: string, data: string, encrypt: boolean, callback: (success: boolean) => void) {
        
    }
    getStorage(key: string, encrypt: boolean, callback: (success: boolean, data: any) => void) {
        if (callback) {
            callback(true, null)
        }
    }

    async getSystemInfo() {
        let info = {} as SystemInfo
        info.appKey = 'com.evolution.riddle8.nearme.gamecenter'
        info.oaid = null
        info.brand = 'H5'
        info.version = '1.0.0'
        return info
    }
    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return false
    }
    
    showToast(text: string, icon?: "success" | "error" | "loading" | "none") {
        
    }
    request(data: { url: string; data?: any; header?: any; timeout?: number; method?: "POST" | "GET"; dataType?: "json"; success?: (res: any) => void; fail?: (res: any) => void; }) {
        if (data.data && data.header && data.header['content-type']?.includes('application/x-www-form-urlencoded')) {
            data.data = Object.keys(data.data).map(function (key) {
                return encodeURIComponent(key) + "=" + encodeURIComponent(data.data[key]);
            }).join("&");
        }

        if (data.data && data.header && data.header['content-type']?.includes('application/json')) {
            data.data = JSON.stringify(data.data)
        }
        
        fetch(data.url, { method: data.method, headers: data.header, body:data.data}).then(async (response: Response) => {
            if (response.status === 200) {
                let jsonData = await response.json()
                if (data.success) {
                    data.success({ success: true, data: jsonData })
                }
            } else {
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
            }
        }).catch((response) => {
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        })
    }
    navigateToMiniProgram(appid: string) {
        
    }

    getHomeAdCompleteInfo(callback: (data: any) => void): any {
    }

    getLaunchOptionsAsync(): Promise<LaunchData> {
        return null
    }
    createGamePortalAd(adUnitId: string, multiton: boolean) {
        
    }
    createCustomAd(adUnitId: string, style: any) {
        
    }
    getScreenSize(): { width: number; height: number; } {
        return null
    }

    onHide(listener: OnHideListener) {
    
    }
    uploadPageOpenEvent(pageName: string): void {
        console.log('uploadPageOpenEvent:', pageName)
    }
}
