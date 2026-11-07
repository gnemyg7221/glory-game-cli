import { Size } from 'cc';
import { AdGlobal } from '../../dispose/AdGlobal';
import { AdUnitIdKey, AuthorityResponse, AuthorizeResponse, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from '../Base/BaseOpenAPI';


export class ByteDanceOpenAPI extends BaseOpenAPI {
  vibrate(long: boolean): void {
    if (long) {
      tt.vibrateLong?.({});
    } else {
      tt.vibrateShort?.({});
    }
  }
  needPrivacyAlert(): boolean {
    return false
  }
  showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
    return false
  }
  createScreenAd(adUnitId: string) {
    
  }
  createNativeAd(adUnitId: string, style?: any) {
    
  }
  openUrl(uri: string): void {
    
  }
  toTempFilePathAsync(data: any, callBack: (path: string) => void): void {
    let canvas = document.getElementById('glcanvas') as any

    if (!canvas || !canvas.toTempFilePath) {
      if (callBack) {
        callBack(null)
      }
      return
    }

    canvas.toTempFilePath({
      x: data.x,
      y: data.y,
      width: data.w,
      height: data.h,
      destWidth: data.destWidth,
      destHeight: data.destHeight,
      success: (res) => {
        if (callBack) {
          callBack(res.tempFilePath)
        }
      },
      fail(res) {
        callBack(null)
      }
    })
  }
  toTempFilePathSync(data: any): string {
    return null
  }
  async login(): Promise<LoginData> {
    let data = {} as LoginData
    data.success = true
    return data
  }

  getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
    return null
  }
  showShare(): boolean {
    return false
  }

  

  onHide(listener: OnHideListener) {

  }
  showPrivacy(): boolean {
    return false
  }
  installShortcut(callback: (success: any) => void): void {
  }

  exitApplication(data: any) {
  }
  onShow(listener: (res: LaunchData) => void) {
    if (!tt.onShow) {
      return
    }
    tt.onShow((res) => {
      listener(res as LaunchData)
    })
  }

  getLaunchOptionsSync(): LaunchData {
    if (!tt.getLaunchOptionsSync) {
      return null
    }
    return tt.getLaunchOptionsSync() as unknown as LaunchData
  }


  shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
    let response = new BaseOpenAPIResponse()
    if (!tt.shareAppMessage) {
      response.success = false
      response.erorrMsg = 'API 不存在'
      callback(response)
      return
    }

    tt.shareAppMessage({
      ...shareAppMessage,
      complete: (res) => {
        if (!res.errMsg) {
          response.success = true
          callback(response)
        } else {
          response.success = false
          response.erorrMsg = res.errMsg
          callback(response)
        }
      }
    })
  }

  showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {
    let response = new BaseOpenAPIResponse()
    if (!tt.showShareMenu) {
      response.success = false
      response.erorrMsg = 'API 不存在'
      callback(response)
      return
    }

    tt.showShareMenu({
      success: () => {
        response.success = true
        callback(response)
      },
      fail: (err) => {
        response.success = false
        response.erorrMsg = err.errMsg
        callback(response)
      }
    })
  }

  // 字节不支持
  onShareTimeline(listener) {
    return null
  }

  onShareAppMessage(listener) {
    if (!tt.onShareAppMessage) {
      return
    }

    tt.onShareAppMessage(listener)
  }

  getUserInfo(needLogin: boolean, showButton: boolean, buttonStyle: GetUserInfoButtonStyle, buttonShowCallback: ((button: any) => void), callback: (response: UserInfoResponse) => void) {
    let response = new UserInfoResponse()
    if (!tt.getUserInfo) {
      response.success = false
      response.erorrMsg = 'API 不存在'
      callback(response)
      return
    }

    tt.getUserInfo({
      withCredentials: needLogin,
      success: (res) => {
        console.log('')
        response.success = true
        response.userInfo = { nickName: res.userInfo?.nickName, avatarUrl: res.userInfo?.avatarUrl, gender: res.userInfo?.gender }
        response.encryptedData = res.encryptedData
        response.signature = res.signature
        response.iv = res.iv
        callback(response)
      },
      fail: (res) => {
        response.success = false
        response.erorrMsg = res.errMsg
        callback(response)
      }
    })
  }

  getScreenSize() {
    let sysInfo = tt.getSystemInfoSync();
    if (!sysInfo) {
      return null
    }
    let screenW = sysInfo.screenWidth;
    let screenH = sysInfo.screenHeight;
    return { width: screenW, height: screenH }
  }

  // 授权(userInfo 要单独授权)
  authorize(scope: string, callback: (response: AuthorizeResponse) => void) {
    let response = new AuthorizeResponse()
    if (!tt.getSetting || !tt.authorize) {
      response.success = false
      response.erorrMsg = 'API 不存在'
      callback(response)
      return
    }

    tt.getSetting({
      success(res) {
        if (!res.authSetting[scope]) {
          tt.authorize({
            scope: scope,
            success() {
              response.success = true
              response.authorize = true
              callback(response)
            },
            fail(res) {
              response.success = true
              response.authorize = false
              response.erorrMsg = res.errMsg
              callback(response)
            }
          })
        } else {
          response.success = true
          response.authorize = true
          callback(response)
        }
      },
      fail(res) {
        response.success = false
        response.authorize = false
        response.erorrMsg = res.errMsg
        callback(response)
      }
    })
  }


  checkSession(callback: (success: boolean) => void) {
    tt.checkSession({
      success() {
        callback(true)
      },
      fail() {
        callback(true)
      }
    })
  }


  postMessage(data: any) {
    if (!tt.getOpenDataContext) {
      return
    }
    let openDataContext = tt.getOpenDataContext()
    openDataContext.postMessage(data)
  }

  adUsable() {
    return true
  }

  createRewardedVideoAd(adUnitId: string, multiton: boolean) {
    if (!this.adUsable()) {
      return null
    }

    if (!tt.createRewardedVideoAd) {
      return null
    }

    return tt.createRewardedVideoAd({ adUnitId: adUnitId })
  }

    createBannerAd(adUnitId: string, adIntervals: number, style: any) {
    if (!this.adUsable()) {
      return null
    }

    if (!tt.createBannerAd) {
      return null
    }

    return tt.createBannerAd({ adUnitId: adUnitId, adIntervals: adIntervals, style: style })
  }

  setStorage(key: string, data: string, encrypt: boolean, callback: ((success: boolean) => void)) {
    if (!tt.setStorage) {
      callback(false)
      return
    }
    tt.setStorage({
      key: key,
      data: data,
      success: () => {
        if (callback) {
          callback(true)
        }
      },
      fail: () => {
        if (callback) {
          callback(false)
        }
      }
    })
  }

  getStorage(key: string, encrypt: boolean, callback: ((success: boolean, data: any) => void)) {
    if (!tt.getStorage) {
      callback(false, null)
      return
    }
    tt.getStorage({
      key: key,
      success: (res) => {
        callback(true, res.data)
      }, fail: (res) => {
        callback(false, null)
      }
    })
  }

  getUpdateManager() {
    const updateManager = tt.getUpdateManager()
    return updateManager
  }

  showModal(title: string, content: string, confirmText: string, showCancel: boolean, cancelText: string, success: ((res: any) => void)) {
    tt.showModal({
      title: title,
      content: content,
      confirmText: confirmText,
      showCancel: showCancel,
      cancelText: cancelText,
      success: success
    })
  }

  getCanvesSize(): Size {
    var canvas = document.createElement("canvas");
    if (!canvas) {
      return null
    }
    return new Size(canvas.width, canvas.height)
  }

  createInterstitialAd(adUnitId: string) {
    if (!this.adUsable()) {
      return null
    }

    if (!tt.createInterstitialAd) {
      return null
    }

    return tt.createInterstitialAd({ adUnitId: adUnitId })
  }

  async getSystemInfo() {

    const { microapp, common } = tt.getEnvInfoSync();

    let info = {} as SystemInfo
    info.appKey = 'com.glorious.yibuzoutianxia.bytedance'
    info.oaid = null
    info.brand = 'ByteDance'
    info.version = microapp?.mpVersion ?? '1.0.0'
    info.companyKey = 'GRJH'
    return info
  }

  showToast(text: string, icon?: 'success' | 'error' | 'loading' | 'none') {
    let ttIcon: any = icon
    if (ttIcon === 'error') {
      ttIcon = 'fail'
    }
    tt.showToast({ title: text, icon: ttIcon })
  }

  getAdUnitId(key: AdUnitIdKey) {
    let adId = AdGlobal.getAdUnitId(key)
    if (adId) {
      return adId
    }

    const fallback: Partial<Record<AdUnitIdKey, string>> = {};
    return fallback[key] || null
  }

  request(data: { url: string; data?: any; header?: any; timeout?: number; method?: 'POST' | 'GET'; dataType?: 'json'; success?: (res: any) => void; fail?: (res: any) => void; }) {
    tt.request(data)
  }

  navigateToMiniProgram(appid: string) {
    tt.navigateToMiniProgram({ appId: appid })
  }

  async getLaunchOptionsAsync(): Promise<LaunchData> {
    if (!tt.getLaunchOptionsSync) {
      return null
    }
    return tt.getLaunchOptionsSync() as unknown as LaunchData
  }
  createGamePortalAd(adUnitId: string, multiton: boolean) {

  }
  createCustomAd(adUnitId: string, style: any) {

  }
  uploadPageOpenEvent(pageName: string): void {
        
  }
}


