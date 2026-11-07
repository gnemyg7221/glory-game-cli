import { Size } from "cc";
import { AdGlobal } from "../../dispose/AdGlobal";
import { AdUnitIdKey, BaseOpenAPI, BaseOpenAPIResponse, LaunchData, LoginData, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from "../Base/BaseOpenAPI";

// mg-service release
export class VivoOpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
        if (long) {
            qg.vibrateLong()
        }else{
            qg.vibrateShort()
        }
    }
    needPrivacyAlert(): boolean {
        return false
    }
    createScreenAd(adUnitId: string) {
        
    }
    createNativeAd(adUnitId: string, style?: any) {
       
    }
    openUrl(uri: string): void {
        
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
        qg.share()
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
        let data = qg.getLaunchOptionsSync()
        launchData.query = data?.query
        launchData.referrerInfo = data?.referrerInfo
        return launchData
    }

    async getLaunchOptionsAsync(): Promise<LaunchData> {
        let launchData = {} as LaunchData
        let launchOption = qg.getLaunchOptionsSync()
        if (!launchOption) {
            return launchData
        }

        const extraData = launchOption?.referrerInfo?.extraData;
        const internal = launchOption?.query?.internal;
        if (extraData){ //1105 及以上获取方式
            launchData.query = extraData
        }else{
            const custom_params = internal?.custom_params;//获取到dp启动来源参数
            if (custom_params) {
                let queryData = this.urlParams(custom_params)
                launchData.query = queryData
            }
        }
        return launchData
    }

    urlParams(scene) {
        const str = decodeURIComponent(scene).replace('?', '&')
        let strArr = str.split('&')
        const result = {}
        strArr.forEach(item => {
            const key = item.split('=')
            if (key.length !== 2) {
                return
            }
            result[key[0]] = key[1]
        })
        return result
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

        return qg.createRewardedVideoAd({ posId: adUnitId })
    }

    createGamePortalAd(adUnitId: string, multiton: boolean) {
        let size = this.getScreenSize()
        if (!size) {
            return null
        }
        let width = size.width
        let height = size.height
        let style = {top: height/2 - 300, left: 50, width: width - 100}

        if (!this.adUsable()) {
            return null
        }

        if (!qg.createCustomAd) {
            return null
        }

        return qg.createCustomAd({ posId: adUnitId, style})
    }

    createBannerAd(adUnitId: string, adIntervals: number, style: { left?: number; top?: number; width?: number; height?: number; }) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createBannerAd) {
            return null
        }

        return qg.createBannerAd({ posId: adUnitId, adIntervals: adIntervals, style: style })
    }

    createInterstitialAd(adUnitId: string) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createInterstitialAd) {
            return null
        }

        return qg.createInterstitialAd({ posId: adUnitId })
    }
    
    createCustomAd(adUnitId: string, style: any) {
    
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createCustomAd) {
            return null
        }

        return qg.createCustomAd({ posId: adUnitId, style})
    }

    // [{"key":"StartScreen1","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"StartScreen","icomePlatform":"VIVO"},{"key":"Rewarded1","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"Rewarded","icomePlatform":"VIVO"},{"key":"Rewarded2","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"Rewarded","icomePlatform":"VIVO"},{"key":"Rewarded3","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"Rewarded","icomePlatform":"VIVO"},{"key":"Rewarded4","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"Rewarded","icomePlatform":"VIVO"},{"key":"GameActionRewarded","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"Rewarded","icomePlatform":"VIVO"},{"key":"CustomTemplateAd1","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"CustomAd","icomePlatform":"VIVO"},{"key":"CustomTemplateAd2","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"CustomAd","icomePlatform":"VIVO"},{"key":"CustomTemplateAd3","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"CustomAd","icomePlatform":"VIVO"},{"key":"CustomTemplateAd4","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"CustomAd","icomePlatform":"VIVO"},{"key":"Banner1","appId":"510ccd0f2f9242ee9826c758c18cfd6a","type":"Banner","icomePlatform":"VIVO"}]
     getAdUnitId(key: AdUnitIdKey) {
        let adId = AdGlobal.getAdUnitId(key)
        if (adId) {
            return adId
        }


        return null
    }

    setStorage(key: string, data: string, encrypt: boolean, callback: (success: boolean) => void) {
        qg.setStorage({
            key: key,
            value: data,
            success: function (data) {
                if (callback) {
                    callback(true)
                }
            },
            fail: function (data, code) {
                if (callback) {
                    callback(false)
                }
            }
          })
    }

    getStorage(key: string, encrypt: boolean, callback: (success: boolean, data: any) => void) {
        qg.getStorage({
            key: key,
            success: function (data) {
                if (callback) {
                    callback(true, data)
                }
            },
            fail: function (data, code) {
                if (callback) {
                    callback(false, null)
                }
            }
          })
    }

    async getSystemInfo() {
        let getManifestInfo = () => {
            return new Promise<any>(async (resolve) => {
                qg.getManifestInfo({
                    success: function (res) {
                        if (res?.manifest) {
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
                        if (res) {
                            resolve(res)
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

        let manifestInfo = await getManifestInfo()
        let systemInfo = await getSystemInfo()

        let version = '1.0.0'
        if (manifestInfo && manifestInfo.versionName) {
            version = manifestInfo.versionName + ""
        }

        let packageName = 'com.null.vivominigame'
        if (manifestInfo && manifestInfo.package) {
            packageName = manifestInfo.package
        }

        let info = {} as SystemInfo
        info.appKey = packageName
        info.oaid = qg.getOAID?.()?.oaid;
        info.brand = 'VIVO'
        info.companyKey = 'GRJH'
        info.version = version
        info.multipleAd = (systemInfo?.adApiVersion >= 1)
        return info
    }

    getScreenSize(): { width: number; height: number; version: string } {
        let info = qg.getSystemInfoSync()
        return { height: info?.screenHeight, width: info?.screenWidth, version: info?.COREVersion }
    }

    showToast(text: string, icon?: "success" | "error" | "loading" | "none") {
        qg.showToast({ message: text });
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

    navigateToMiniProgram(appid: string) {

    }

    exitApplication(data: any) {
        qg.exitApplication(data)
    }

    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return null
    }

    uploadPageOpenEvent(pageName: string){
    }

}