import { Size } from "cc"

export class BaseOpenAPIResponse {
    success: boolean
    erorrMsg: string
}

export class AuthorizeResponse extends BaseOpenAPIResponse {
    authorize: boolean
}

export class LoginResponse extends BaseOpenAPIResponse {
    code: string
    uid: string
    userName: string
}

export interface UserInfo {
    nickName: string
    avatarUrl: string
    gender: number
}

export interface LaunchData {
    scene: number | string
    query: any
    launch_from?: string
    location?: string
    referrerInfo: any
}

export interface LoginData {
    success: boolean
}

export class UserInfoResponse extends BaseOpenAPIResponse {
    buttonIsShowed: boolean
    userInfo: UserInfo
    rawData: string
    signature: string
    encryptedData: string
    iv: string
}

export class AuthorityResponse extends BaseOpenAPIResponse {
    authority: boolean
}

export enum ShareType {
    InviteFriendsJoinRoom = 1
}

export interface ShareAppMessageRequest {
    title?: string
    imageUrl?: string
    query?: string
    imageUrlId?: string

    // 字节需要
    desc?: string
    templateId?: string
}

export interface GetUserInfoButtonStyle {
    x: number
    y: number
    w: number
    h: number
    text: string
    textColor: string
    backgroundColor: string
}

export interface SystemInfo {
    companyKey: string
    appKey: string
    brand: string
    version: string
    multipleAd: boolean
    forbidPrivacyDialog: boolean
    platformVersionCode: number

    idfa: string
    oaid: string
    imei: string
    androidId: string
}

export enum AdUnitIdKey {

    // 激励
    Rewarded1 = 'Rewarded1',
    Rewarded2 = 'Rewarded2',
    Rewarded3 = 'Rewarded3',
    Rewarded4 = 'Rewarded4',
    GameActionRewarded = 'GameActionRewarded',

    // 原生模版
    CustomTemplateAd1 = 'CustomTemplateAd1',
    CustomTemplateAd2 = 'CustomTemplateAd2',
    CustomTemplateAd3 = 'CustomTemplateAd3',
    CustomTemplateAd4 = 'CustomTemplateAd4',

    // 原生自渲染
    CustomAd1 = 'CustomAd1',
    CustomAd2 = 'CustomAd2',
    CustomAd3 = 'CustomAd3',
    CustomAd4 = 'CustomAd4',
    CustomAdMenu = 'CustomAdMenu',

    Banner1 = 'Banner1',
    GamePortal1 = 'GamePortal1',

    // 插屏
    InterstitialAd1 = 'InterstitialAd1',
    InterstitialAd2 = 'InterstitialAd2',
    InterstitialAd3 = 'InterstitialAd3',

}

export type OnShowListener = (res: LaunchData) => void
export type OnHideListener = () => void

export abstract class BaseOpenAPI {
    /** 分享相关 */
    abstract onShareTimeline(listener: () => ShareAppMessageRequest): void
    abstract onShareAppMessage(listener: () => ShareAppMessageRequest): void
    abstract showShareMenu(withShareTicket: boolean, menus: string[], callback: ((response: BaseOpenAPIResponse) => void)): void
    abstract shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: ((response: BaseOpenAPIResponse) => void)): void
    abstract showShare(): boolean

    // 登录
    abstract login(): Promise<LoginData>

    // 截图
    abstract toTempFilePathSync(data: any): string
    abstract toTempFilePathAsync(data: any, callBack: ((path: string) => void)): void
    abstract getCanvesSize(): Size

    // 生命周期
    abstract onShow(listener: OnShowListener): void
    abstract onHide(listener: OnHideListener): void

    // 监听并获取启动参数
    abstract getLaunchOptionsSync(): LaunchData
    abstract getLaunchOptionsAsync(): Promise<LaunchData>

    /** 广告相关 */
    abstract adUsable(): boolean
    abstract getAdUnitId(key: AdUnitIdKey): any
    abstract createRewardedVideoAd(adUnitId: string, multiton: boolean): any
    abstract createGamePortalAd(adUnitId: string, multiton: boolean): any
    abstract createCustomAd(adUnitId: string, style: any): any
    abstract createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }): any
    abstract createInterstitialAd(adUnitId: string): any
    abstract createScreenAd(adUnitId: string): any
    abstract createNativeAd(adUnitId: string, style?: any): any

    /** 文件相关 */
    abstract setStorage(key: string, data: string, encrypt: boolean, callback: ((success: boolean) => void)): void
    abstract getStorage(key: string, encrypt: boolean, callback: ((success: boolean, data: any) => void)): void

    /** 环境相关 */
    abstract getSystemInfo(): Promise<SystemInfo>
    abstract getScreenSize(): { width: number, height: number }

    /** UI相关 */
    abstract showToast(text: string, icon?: "success" | "error" | "loading" | "none"): void
    abstract needPrivacyAlert(): boolean
    abstract showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean
    abstract getMenuButtonBoundingClientRect(): { left: number, top: number, width: number, height: number, right: number, bottom: number }

    /** 网络 */
    abstract request(data: { url: string, data?: any, header?: any, timeout?: number, method?: 'POST' | 'GET', dataType?: 'json' | null, success?: ((res: any) => void), fail?: ((res: any) => void) }): void

    /** 路由 */
    abstract navigateToMiniProgram(appid: string): void
    abstract exitApplication(data: any): void
    abstract openUrl(uri: string): void

    /** 加桌 */
    abstract installShortcut(callback: ((success: boolean) => void)): void

    /** 其他 */
    abstract vibrate(long: boolean): void

     /** 原生 */
    abstract uploadPageOpenEvent(pageName: string): void
}

