import { Size } from 'cc';
import { AdGlobal } from '../../dispose/AdGlobal';
import { AdUnitIdKey, AuthorityResponse, AuthorizeResponse, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from '../Base/BaseOpenAPI';
export class WeChatOpenAPI extends BaseOpenAPI {
  vibrate(long: boolean): void {
    if (long) {
      wx.vibrateLong?.({});
    } else {
      wx.vibrateShort?.({});
    }
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

  showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
    return false
  }

  getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
    return null
  }
  showShare(): boolean {
    return true
  }
  showPrivacy(): boolean {
    return false
  }
  installShortcut(callback: (success: any) => void): void {
    if (!wx['createPageManager']) {
      return
    }
    const pageManager = wx['createPageManager']();
    pageManager.on(
      'error',
      () => {
        callback ?? callback(false)
      },
    )
    pageManager.on(
      'destroy', // show | destroy | error
      (res: any) => {
        callback ?? callback(res.isRecommended)
      },
    )
    pageManager.show({
      openlink: 'TWFRCqV5WeM2AkMXhKwJ03MhfPOieJfAsvXKUbWvQFQtLyyA5etMPabBehga950uzfZcH3Vi3QeEh41xRGEVFw', // 推荐组件OPENLINK常量，直接复制即可，无需理解含义
    });
  }

  exitApplication(data: any) {

  }

  onShow(listener: (res: LaunchData) => void) {
    wx.onShow((res) => {
      listener(res as LaunchData)
    })
  }

  getLaunchOptionsSync(): LaunchData {
    return wx.getLaunchOptionsSync() as LaunchData
  }

  shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
    let response = new BaseOpenAPIResponse()
    wx.shareAppMessage({
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

  toTempFilePathSync(data: any): string {
    return null
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

  getCanvesSize(): Size {
    var canvas = document.createElement("canvas");
    if (!canvas) {
      return null
    }
    return new Size(canvas.width, canvas.height)
  }

  showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {
    let response = new BaseOpenAPIResponse()
    wx.showShareMenu({
      withShareTicket: withShareTicket,
      menus: menus,
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

  onShareTimeline(listener) {
    if (!wx.onShareTimeline) {
      return
    }
    wx.onShareTimeline(listener)
  }

  onShareAppMessage(listener) {
    if (!wx.onShareAppMessage) {
      return
    }

    wx.onShareAppMessage(listener)
  }

  getScreenSize() {
    let sysInfo = wx.getSystemInfoSync();
    if (!sysInfo) {
      return null
    }
    let screenW = sysInfo.screenWidth;
    let screenH = sysInfo.screenHeight;
    return { width: screenW, height: screenH }
  }

  adUsable() {
    return true
  }

  createRewardedVideoAd(adUnitId: string, multiton: boolean) {
    if (!wx.createRewardedVideoAd) {
      return null
    }

    return wx.createRewardedVideoAd({ adUnitId: adUnitId, multiton: multiton })
  }

  createInterstitialAd(adUnitId: string) {
    if (!wx.createInterstitialAd) {
      return null
    }

    return wx.createInterstitialAd({ adUnitId: adUnitId })
  }

  createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number, top?: number, width?: number, height?: number }) {

    if (!wx.createBannerAd) {
      return null
    }

    if (!style) {
      var windowHeight = wx.getSystemInfoSync().windowHeight - 120;
      style = {
        left: (wx.getSystemInfoSync().windowWidth - 300) / 2,
        top: windowHeight,
        height: 100,
        width: 300
      }
    }

    return wx.createBannerAd({ adUnitId: adUnitId, adIntervals: adIntervals, style: style })
  }

  setStorage(key: string, data: string, encrypt: boolean, callback: ((success: boolean) => void)) {
    wx.setStorage({
      key: key,
      data: data,
      encrypt: encrypt, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
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
    wx.getStorage({
      key: key,
      encrypt: encrypt, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
      success: (res) => {
        callback(true, res.data)
      }, fail: (res) => {
        callback(false, null)
      }
    })
  }

  showModal(title: string, content: string, confirmText: string, showCancel: boolean, cancelText: string, success: ((res: any) => void)) {
    wx.showModal({
      title: title,
      content: content,
      confirmText: confirmText,
      showCancel: showCancel,
      cancelText: cancelText,
      success: success
    })
  }

  showToast(text: string, icon: "success" | "error" | "loading" | "none") {
    wx.showToast({ title: text, icon: icon })
  }

  async getSystemInfo() {
    const accountInfo = wx.getAccountInfoSync();
    let info = {} as SystemInfo
    info.appKey = 'com.glorious.yibuzoutianxia.wechat'
    info.oaid = null
    info.brand = 'WeChat'
    info.version = '1.0.0'
    info.companyKey = 'GRJH'
    if (accountInfo?.plugin?.version) {
      info.version = accountInfo?.plugin?.version
    }
    return info
  }

  request(data: { url: string; data?: any; header?: any; timeout?: number; method?: 'POST' | 'GET'; dataType?: 'json'; success?: (res: any) => void; fail?: (res: any) => void; }) {
    wx.request(data)
  }

  navigateToMiniProgram(appid: string) {
    wx.navigateToMiniProgram({ appId: appid })
  }

  getAdUnitId(key: AdUnitIdKey) {
    const fromServer = AdGlobal.getAdUnitId(key);
    if (fromServer) {
      return fromServer;
    }
    const fallback: Partial<Record<AdUnitIdKey, string>> = {};
    return fallback[key] || null;
  }

  async getLaunchOptionsAsync(): Promise<LaunchData> {
    return wx.getLaunchOptionsSync() as LaunchData
  }

  createGamePortalAd(adUnitId: string, multiton: boolean) {
    return null
  }

  createCustomAd(adUnitId: string, style: any) {
    if (!wx['createCustomAd']) {
      return null
    }

    if (!style) {
      let size = this.getScreenSize()
      let width = size?.width
      let height = size?.height
      style = { top: height - 400, left: (width - 360) / 2, width: 360 }
    }


    return wx['createCustomAd']({ adUnitId: adUnitId, style: style })
  }

  onHide(listener: OnHideListener) {
  }

  uploadPageOpenEvent(pageName: string){
  }
}


