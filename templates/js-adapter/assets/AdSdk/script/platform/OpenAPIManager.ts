import { Size } from 'cc';
import { EnvUtils } from '../utils/EnvUtils';
import { AdUnitIdKey, BaseOpenAPI, BaseOpenAPIResponse, LaunchData, LoginData, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo } from './Base/BaseOpenAPI';
import { ByteDanceOpenAPI } from './ByteDance/ByteDanceOpenAPI';
import { DevOpenAPI } from './Dev/DevOpenAPI';
import { H5OpenAPI } from './H5/H5OpenAPI';
import { HuaWeiOpenAPI } from './HUAWEI/HuaWeiOpenAPI';
import { NativeOpenAPI } from './Native/NativeOpenAPI';
import { OppoOpenAPI } from './OPPO/OppoOpenAPI';
import { RongYaoOpenAPI } from './RongYao/RongYaoOpenAPI';
import { VivoOpenAPI } from './VIVO/VivoOpenAPI';
import { WeChatOpenAPI } from './WeChat/WeChatOpenAPI';
import { XiaoMiOpenAPI } from './XiaoMi/XiaoMiOpenAPI';

export class OpenAPIManager extends BaseOpenAPI {

    private static _inst: OpenAPIManager;
    public static get inst(): OpenAPIManager {
        if (this._inst == null) {
            this._inst = new OpenAPIManager();
        }
        return this._inst;
    }

    private api: BaseOpenAPI

    public adUsableStr: string = null

    private onShowListenerInit = false
    private onHideListenerInit = false
    private onShowListenerInfo: Map<string, OnShowListener> = new Map()
    private onHideListenerInfo: Map<string, OnHideListener> = new Map()

    constructor() {
        super()
        this.api = this.resolveOpenAPI()
        if (this.api instanceof NativeOpenAPI) {
            this.api.init()
        }
    }

    /** 保持现有优先级：DEV → ANDROID → OPPO → HUAWEI → VIVO → BYTEDANCE → RONGYAO → XIAOMI → WECHAT → H5 */
    private resolveOpenAPI(): BaseOpenAPI {
        if (EnvUtils.DEV()) {
            return new DevOpenAPI()
        }
        if (EnvUtils.ANDROID()) {
            return new NativeOpenAPI()
        }
        if (EnvUtils.OPPO()) {
            return new OppoOpenAPI()
        }
        if (EnvUtils.HUAWEI()) {
            return new HuaWeiOpenAPI()
        }
        if (EnvUtils.VIVO()) {
            return new VivoOpenAPI()
        }
        if (EnvUtils.BYTEDANCE()) {
            return new ByteDanceOpenAPI()
        }
        if (EnvUtils.RONGYAO()) {
            return new RongYaoOpenAPI()
        }
        if (EnvUtils.XIAOMI()) {
            return new XiaoMiOpenAPI()
        }
        if (EnvUtils.WECHAT()) {
            return new WeChatOpenAPI()
        }
        if (EnvUtils.H5()) {
            return new H5OpenAPI()
        }
        throw 'nonsupport platform'
    }

    showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {
        this.api.showShareMenu(withShareTicket, menus, callback)
    }

    onShareTimeline(listener) {
        this.api.onShareTimeline(listener)
    }

    onShareAppMessage(listener) {
        this.api.onShareAppMessage(listener)
    }

    shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
        this.api.shareAppMessage(shareAppMessage, callback)
    }

    removeOnShowListener(key: string) {
        this.onShowListenerInfo.delete(key)
    }

    addOnShowListener(key: string, listener: OnShowListener) {
        if (!this.onShowListenerInit) {
            this.onShow((res) => {
                this.onShowListenerInfo.forEach((listener) => {
                    listener(res)
                })
            })
            this.onShowListenerInit = true
        }
        this.onShowListenerInfo.set(key, listener)
    }

    removeOnHideListener(key: string) {
        this.onHideListenerInfo.delete(key)
    }

    addOnHideListener(key: string, listener: OnHideListener) {
        if (!this.onHideListenerInit) {
            this.onHide(() => {
                this.onHideListenerInfo.forEach((listener) => {
                    listener()
                })
            })
            this.onHideListenerInit = true
        }
        this.onHideListenerInfo.set(key, listener)
    }

    login(): Promise<LoginData> {
        return this.api.login()
    }

    onHide(listener: OnHideListener) {
        this.api.onHide(listener)
    }

    onShow(listener: OnShowListener) {
        this.api.onShow(listener)
    }

    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return this.api.showPrivacyAlert(showView, checkShowed, callBack)
    }

    getLaunchOptionsSync(): LaunchData {
        return this.api.getLaunchOptionsSync()
    }

    getLaunchOptionsAsync(): Promise<LaunchData> {
        return this.api.getLaunchOptionsAsync()
    }

    showShare(): boolean {
        return this.api.showShare()
    }

    adUsable() {
        if (this.adUsableStr === 'false') {
            return false
        }
        return this.api.adUsable()
    }

    createGamePortalAd(adUnitId: string, multiton: boolean) {
        return this.api.createGamePortalAd(adUnitId, multiton)
    }

    createRewardedVideoAd(adUnitId: string, multiton: boolean) {
        return this.api.createRewardedVideoAd(adUnitId, multiton)
    }

    createInterstitialAd(adUnitId: string) {
        return this.api.createInterstitialAd(adUnitId)
    }

    createCustomAd(adUnitId: string, style: any) {
        return this.api.createCustomAd(adUnitId, style)
    }

    createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }) {
        return this.api.createBannerAd(adUnitId, adIntervals, style)
    }

    setStorage(key: string, data: string, encrypt: boolean, callback: ((success: boolean) => void)) {
        this.api.setStorage(key, data, encrypt, callback)
    }

    getStorage(key: string, encrypt: boolean, callback: ((success: boolean, data: any) => void)) {
        this.api.getStorage(key, encrypt, callback)
    }

    getScreenSize() {
        return this.api.getScreenSize()
    }

    showToast(title: string, icon?: "success" | "error" | "loading" | "none") {
        this.api.showToast(title, icon)
    }

    toTempFilePathSync(data: any): string {
        return this.api.toTempFilePathSync(data)
    }

    toTempFilePathAsync(data: any, callBack: (path: string) => void): void {
        this.api.toTempFilePathAsync(data, callBack)
    }

    getCanvesSize(): Size {
        return this.api.getCanvesSize()
    }

    getSystemInfo(): Promise<SystemInfo> {
        return this.api.getSystemInfo()
    }

    getAdUnitId(key: AdUnitIdKey) {
        return this.api.getAdUnitId(key)
    }

    request(data: { url: string; data?: any; header?: any; timeout?: number; method?: 'POST' | 'GET'; dataType?: 'json'; success?: (res: any) => void; fail?: (res: any) => void; }) {
        this.api.request(data)
    }

    installShortcut(callback: (success: any) => void): void {
        this.api.installShortcut(callback)
    }

    navigateToMiniProgram(appid: string) {
        this.api.navigateToMiniProgram(appid)
    }

    exitApplication(data: any) {
        this.api.exitApplication(data)
    }

    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return this.api.getMenuButtonBoundingClientRect()
    }

    createNativeAd(adUnitId: string, style: any) {
        return this.api.createNativeAd(adUnitId, style)
    }

    openUrl(uri: string) {
        this.api.openUrl(uri)
    }

    createScreenAd(adUnitId: string) {
        return this.api.createScreenAd(adUnitId)
    }

    needPrivacyAlert(): boolean {
        return this.api.needPrivacyAlert()
    }

    vibrate(long: boolean): void {
        this.api.vibrate(long)
    }

    registerEvent = (key: string, event: ((data: any) => void)) => {
        if (this.api instanceof NativeOpenAPI) {
            this.api.registerEvent(key, event)
        }
    }
    
    uploadPageOpenEvent(pageName: string){
        this.api.uploadPageOpenEvent(pageName)
    }
}
