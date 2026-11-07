import { Size } from "cc";
import { AdGlobal } from "../../dispose/AdGlobal";
import { AdUnitIdKey, BaseOpenAPI, BaseOpenAPIResponse, LaunchData, LoginData, LoginResponse, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from "../Base/BaseOpenAPI";

// quickgame subpack release  -q
// devtools://devtools/bundled/inspector.html?v8only=true&ws=192.168.0.101:12345/00010002-0003-4004-8005-000600070008

export class OppoOpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
        if (long) {
            qg.vibrateLong()
        } else {
            qg.vibrateShort({ type: "light" })
        }
    }
    needPrivacyAlert(): boolean {
        return true
    }
    openUrl(uri: string): void {
        
    }
    createScreenAd(adUnitId: string) {
        
    }
    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return false
    }
    
    onHide(listener: OnHideListener) {
        qg.onHide(listener)
    }
   
    onShareTimeline(listener: () => ShareAppMessageRequest) {

    }
    
    onShareAppMessage(listener: () => ShareAppMessageRequest) {

    }

    showShareMenu(withShareTicket: boolean, menus: string[], callback: (response: BaseOpenAPIResponse) => void) {

    }

    shareAppMessage(shareAppMessage: ShareAppMessageRequest, callback: (response: BaseOpenAPIResponse) => void) {
        let response = new BaseOpenAPIResponse()
        
        let shareType = 1
        if (shareAppMessage.imageUrl?.length > 0) {
            shareType = 2
        }
       
        qg.serviceShare({
            shareType: shareType,
            title: shareAppMessage.title,
            summary: shareAppMessage.desc,
            imagePath: shareAppMessage.imageUrl,
            success: function (data) {
                response.success = true
                if (callback) {
                    callback(response)
                }
            },
            fail: function (data, code) {
                response.success = false
                if (callback) {
                    callback(response)
                }
                AdGlobal.canLog && console.error(' share failed:' + data + "," + code);
            },
            cancel: function () {
                response.success = false
                if (callback) {
                    callback(response)
                }
                AdGlobal.canLog && console.log(' share cancel');
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
   
    onShow(listener: OnShowListener) {
        qg.onShow(listener)
    }

    getLaunchOptionsSync(): LaunchData {
        let launchData = {} as LaunchData
        let data = qg.getEnterOptionsSync()
        launchData.query = data?.query
        launchData.referrerInfo = data?.referrerInfo
        return launchData
    }

    async getLaunchOptionsAsync(): Promise<LaunchData> {
        let launchData = {} as LaunchData
        let data = qg.getEnterOptionsSync()
        launchData.query = data?.query
        launchData.referrerInfo = data?.referrerInfo
        return launchData
    }

    showShare(): boolean {
        return false
    }

    showPrivacy(): boolean {
        return true
    }

    adUsable() {
        return true
    }

    async login(): Promise<LoginData> {
        let data = {} as LoginData
        data.success = true
        return data
      }

    createRewardedVideoAd(adUnitId: string, multiton: boolean) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createRewardedVideoAd) {
            return null
        }

        return qg.createRewardedVideoAd({ adUnitId: adUnitId })
    }

    createGamePortalAd(adUnitId: string, multiton: boolean) {

        if (qg.getSystemInfoSync().platformVersionCode < 1076) {
            return null
        }

        if (!this.adUsable()) {
            return null
        }

        if (!qg.createGamePortalAd) {
            return null
        }

        return qg.createGamePortalAd({ adUnitId: adUnitId })
    }

    createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createBannerAd) {
            return null
        }

        return qg.createBannerAd({ adUnitId: adUnitId, adIntervals: adIntervals, style: style })
    }

    createInterstitialAd(adUnitId: string) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createInterstitialAd) {
            return null
        }

        return qg.createInterstitialAd({ adUnitId: adUnitId })
    }
    
    createCustomAd(adUnitId: string, style: any) {
    
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createCustomAd) {
            return null
        }

        return qg.createCustomAd({ adUnitId: adUnitId, style})
    }


    // [{"key":"StartScreen1","adDirection":2 ,"appId":"37469545","type":"StartScreen","icomePlatform":"OPPO","bidding":true},{"key":"Rewarded1","appId":"37469545","type":"Rewarded","icomePlatform":"OPPO","bidding":true},{"key":"Rewarded2","appId":"37469545","type":"Rewarded","icomePlatform":"OPPO","bidding":true},{"key":"Rewarded3","appId":"37469545","type":"Rewarded","icomePlatform":"OPPO","bidding":true},{"key":"Rewarded4","appId":"37469545","type":"Rewarded","icomePlatform":"OPPO","bidding":true},{"key":"GameActionRewarded","appId":"37469545","type":"Rewarded","icomePlatform":"OPPO","bidding":true},{"key":"CustomTemplateAd1","appId":"37469545","type":"CustomAd","icomePlatform":"OPPO","bidding":true},{"key":"CustomTemplateAd2","appId":"37469545","type":"CustomAd","icomePlatform":"OPPO","bidding":true},{"key":"CustomTemplateAd3","appId":"37469545","type":"CustomAd","icomePlatform":"OPPO","bidding":true},{"key":"CustomTemplateAd4","appId":"37469545","type":"CustomAd","icomePlatform":"OPPO","bidding":true},{"key":"Banner1","appId":"37469545","type":"Banner","icomePlatform":"OPPO","bidding":true}]
    getAdUnitId(key: AdUnitIdKey) {

        let adId = AdGlobal.getAdUnitId(key)
        if (adId) {
            return adId
        }
        
        return null
    }

    setStorage(key: string, data: string, encrypt: boolean, callback: (success: boolean) => void) {
        localStorage.setItem(key, data);
    }
    
    getStorage(key: string, encrypt: boolean, callback: (success: boolean, data: any) => void) {
        let value = localStorage.getItem(key);
        if (callback) {
            callback(true, value)
        }

    }

    async getSystemInfo() {
        let getDeviceId = () => {
            return new Promise<string>(async (resolve) => {
                qg.getDeviceId({
                    success: function (data) {
                        resolve(data.deviceId)
                    },
                    fail: function (data, code) {
                        resolve(null)
                    },
                });
            })
        }

        let getManifestInfo = () => {
            return new Promise<any>(async (resolve) => {
                qg.getManifestInfo({
                    success: function (res) {
                        if (res.manifest) {
                            resolve(JSON.parse(res.manifest))
                        }else{
                            resolve(null)
                        }
                    },
                    fail: function (err) {
                        resolve(null)
                    },
                    complete: function (res) {
                        resolve(null)
                    },
                  });
            })
        }
        
        let getSystemInfo = () => {
            return new Promise<any>(async (resolve) => {
                qg.getSystemInfo({
                    success: function (res) {
                        resolve(res)
                    },
                    fail: function (err) {
                        resolve(null)
                    },
                    complete: function (res) {
                        resolve(null)
                    },
                });
            })
        }

        let manifestInfo = await getManifestInfo()
        let systemInfo = await getSystemInfo()

        let version = '1.0.0'
        let packageName = 'com.null.nearme.gamecenter'
        if (manifestInfo && manifestInfo.versionName) {
            version = manifestInfo.versionName
        }
        if (manifestInfo && manifestInfo.package) {
            packageName = manifestInfo.package
        }

        let info = {} as SystemInfo
        info.appKey = packageName
        info.oaid = await getDeviceId()
        info.brand = 'OPPO'
        info.companyKey = 'GRJH'
        info.version = version
        info.multipleAd = (systemInfo?.platformVersion >= 1170)

        return info
    }

    getScreenSize(): { width: number; height: number; version: string } {
        let info = qg.getSystemInfoSync()
        return { height: info?.screenHeight, width: info?.screenWidth, version: info?.COREVersion }
    }

    showToast(text: string, icon?: "success" | "error" | "loading" | "none") {
        qg.showToast({ title: text, icon: icon });
    }

    installShortcut(callback: (success: any) => void): void {
        qg.hasShortcutInstalled({
            success: function (res) {
              if (res == false) {
                qg.installShortcut({
                  success: function () {
                    callback(true)
                  },
                  fail: function (err) {
                    callback(false)
                  },
                  complete: function () {},
                });
              }else{
                callback(false)
              }
            },
            fail: function (err) {
                callback(false)
            },
            complete: function () {},
          });
    }
    request(data: { url: string; data?: any; header?: any; timeout?: number; method?: "POST" | "GET"; dataType?: "json"; success?: (res: any) => void; fail?: (res: any) => void; }) {
        var oReq = new XMLHttpRequest();
        oReq.addEventListener("load", (res)=>{
            if (oReq.status === 200) {
                let jsonData = JSON.parse(oReq.responseText)
                if (data.success) {
                    data.success({ success: true, data: jsonData })
                }
            } else {
                AdGlobal.canLog && console.error('[XMLHttpRequest] load error', oReq.status, oReq.responseText)
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
            }
        });
        oReq.addEventListener("error", (res)=>{
            AdGlobal.canLog && console.error('[XMLHttpRequest] error', JSON.stringify(res))
            if (data.fail){
                data.fail({success: false, data: null })
            }
        });

        oReq.addEventListener("abort", (res)=>{
            AdGlobal.canLog && console.error('[XMLHttpRequest] abort', JSON.stringify(res))
            if (data.success){
                data.success({ success: false, data: null })
            }
        });

        oReq.open(data.method, data.url);
        if (data.header) {
            for(let key in data.header) {
                let value = data.header[key]
                oReq.setRequestHeader(key, value)
            }
        }

        if (data.data && data.header && data.header['content-type'] === 'application/x-www-form-urlencoded') {
            data.data = Object.keys(data.data).map(function (key) {
                return encodeURIComponent(key) + "=" + encodeURIComponent(data.data[key]);
            }).join("&");
        }
        oReq.send(data.data);
    }

    createNativeAd(adUnitId: string, style: any) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createNativeAdvanceAd) {
            return null
        }

        return qg.createNativeAdvanceAd({ adUnitId: adUnitId, style})
    
    }

    navigateToMiniProgram(appid: string) {

    }

    exitApplication(data: any) {
        qg.exitApplication(data)
    }

    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return qg.getMenuButtonBoundingClientRect();
    }

    uploadPageOpenEvent(pageName: string){
    }

}
