import { Size } from 'cc';
import { AdUnitIdKey, AuthorityResponse, AuthorizeResponse, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, ShareAppMessageRequest, SystemInfo, UserInfo, UserInfoResponse } from '../Base/BaseOpenAPI';
import { AdGlobal } from '../../dispose/AdGlobal';

export class DevOpenAPI extends BaseOpenAPI {
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
    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } | null {
        return null
    }
    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return false
    }
    async getLaunchOptionsAsync(): Promise<LaunchData> {
        let launchData = {} as LaunchData
        const url = new URL(window.location.href);
        launchData.query = {}
        url.searchParams.forEach((value, key) => {
            launchData.query[key] = value
        })

        return launchData
    }

    createCustomAd(adUnitId: string, style: any) {
        return null
    }

    createGamePortalAd(adUnitId: string, multiton: boolean) {
        return null
    }

    onHide(listener: OnHideListener) {
    }

    getDeviceId(callback: (deviceId: string) => void) {
        callback(null)
    }

    getBrand(): string {
        return 'DEV'
    }

    exitApplication(data: any) {
        console.log('exitApplication', data)
    }
    showShare(): boolean {
        return true
    }
    showPrivacy(): boolean {
        return true
    }

    onShow(listener: (res: LaunchData) => void) {

    }

    getLaunchOptionsSync(): LaunchData {
        let launchData = {} as LaunchData
        const url = new URL(window.location.href);
        launchData.query = {}
        url.searchParams.forEach((value, key) => {
            launchData.query[key] = value
        })

        return launchData
    }
    installShortcut(callback: (success: any) => void): void {
        callback(false)
    }
    shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
        console.log('shareAppMessage:', shareAppMessage)
        let response = new BaseOpenAPIResponse()
        response.success = true
        callback(response)
    }


    showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {
        let response = new BaseOpenAPIResponse()
        response.success = true
        callback(response)
    }
    onShareTimeline(listener) {

    }

    onShareAppMessage(listener) {

    }

    checkSession(callback: (success: boolean) => void) {
        callback(true)
    }

    async login() {
        let data = {} as LoginData
        data.success = true
        return data
    }

    authorize(scope: string, callback: (response: AuthorizeResponse) => void) {
        let response = new AuthorizeResponse()
        setTimeout(() => {
            response.success = true
            response.authorize = true
            callback(response)
        }, 1000);
    }

    getUserInfo(needLogin: boolean, showButton: boolean, buttonStyle: GetUserInfoButtonStyle, buttonShowCallback: ((button: any) => void), callback: (response: UserInfoResponse) => void) {
        let response = new UserInfoResponse()
        setTimeout(() => {
            response.userInfo = {} as UserInfo
            response.userInfo.gender = 1
            response.userInfo.avatarUrl = 'https://t10.baidu.com/it/u=36436257,3216637553&fm=58'
            response.userInfo.nickName = '测试'
            response.success = true
            callback(response)
        }, 1000);
    }

    checkAuthority(key: string, callBack: (response: AuthorityResponse) => void) {
        let response = new AuthorityResponse()
        response.success = true
        response.authority = true
        callBack(response)
    }

    reportScene(sceneId: number, costTime: number, dimension: any) {
        console.log('reportScene:', sceneId, costTime, dimension)
    }

    reportEvent(eventName: string, data: any) {
        console.log('reportEvent:', eventName, data)
    }


    postMessage(data: any) {
        console.log('postMessage:', data)
    }

    reportMonitor(errorId: string, errorLevel: number, errorCode: number, errorMsg: string) {
        console.log('reportMonitor:', errorId, errorLevel, errorCode, errorMsg)
    }

    adUsable() {
        return false
    }

    createRewardedVideoAd(adUnitId: string, multiton: boolean) {
        if (!this.adUsable()) {
            return null
        }

        return null
    }

    createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }) {
        return null
    }

    createInterstitialAd(adUnitId: string) {
        return null
    }

    static storageInfo = {}
    setStorage(key: string, data: string, encrypt: boolean, callback: ((success: boolean) => void)) {
        DevOpenAPI.storageInfo[key] = data
        if (callback) {
            callback(true)
        }
    }

    getStorage(key: string, encrypt: boolean, callback: ((success: boolean, data: any) => void)) {
        if (callback) {
            callback(true, DevOpenAPI.storageInfo[key])
        }
    }

    getEnvVersion() {
        return 'develop'
    }

    getScreenSize() {
        return null
    }
    getUpdateManager() {

        return null
    }

    showModal(title: string, content: string, confirmText: string, showCancel: boolean, cancelText: string, success: ((res: any) => void)) {
        console.log('showModal:', title, content)
    }


    showToast(text: string, icon?: 'success' | 'error' | 'loading' | 'none'): void {
        console.log('showToast:', text, icon)
    }
    toTempFilePathSync(data: any): string | null {
        return null
    }

    toTempFilePathAsync(data: any, callBack: ((path: string) => void)) {
        if (callBack) {
            callBack(null)
        }
    }

    getCanvesSize(): Size {
        return null
    }

    async getSystemInfo() {
        let info = {} as SystemInfo
        info.appKey = 'com.evolution.kaidingrisk.nearme.gamecenter'
        info.oaid = null
        info.brand = 'DEV'
        info.version = '1.0.0'
        info.companyKey = 'GRJH'
        return info
    }

    getAdUnitId(key: AdUnitIdKey) {
        let adId = AdGlobal.getAdUnitId(key)
        if (adId) {
            return adId
        }
        return null
    }

    request(data: { url: string; data?: any; header?: any; timeout?: number; method?: 'POST' | 'GET'; dataType?: 'json'; success?: (res: any) => void; fail?: (res: any) => void; }) {
        if (data.data && data.header && data.header['content-type'] === 'application/x-www-form-urlencoded') {
            data.data = Object.keys(data.data).map(function (key) {
                return encodeURIComponent(key) + "=" + encodeURIComponent(data.data[key]);
            }).join("&");
        }

        fetch(data.url, { method: data.method, headers: data.header, body: data.data }).then(async (response: Response) => {
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
        }).catch(() => {
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        })
    }

    navigateToMiniProgram(appid: string) {
        console.log('navigateToMiniProgram:', appid)
    }

    uploadPageOpenEvent(pageName: string): void {
        console.log('uploadPageOpenEvent:', pageName)
    }
}

