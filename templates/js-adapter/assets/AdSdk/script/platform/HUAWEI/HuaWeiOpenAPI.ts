import { Size } from "cc";
import { AdUnitIdKey, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from "../Base/BaseOpenAPI";

export class HuaWeiOpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
    
    }
    needPrivacyAlert(): boolean {
        return true
    }
    createScreenAd(adUnitId: string) {
        
    }
    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return null
    }
    async login(): Promise<LoginData> {
        let data = {} as LoginData
        data.success = true
        return data
    }
    toTempFilePathSync(data: any): string {
        return null
    }
    toTempFilePathAsync(data: any, callBack: ((path: string) => void)): void {
        if (callBack) {
            callBack(null)
        }
        return
    }
    getCanvesSize(): Size {
        var canvas = document.createElement("canvas");
        if (!canvas) {
            return null
        }
        return new Size(canvas.width, canvas.height)
    }
    
    showShare(): boolean {
        return false
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
    createCustomAd(adUnitId: string, style: any) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createCustomAd) {
            return null
        }

        return qg.createCustomAd({ adUnitId: adUnitId, style})
    
    }
    getScreenSize(): { width: number; height: number; } {
        let info = qg.getSystemInfoSync()
        return { height: info?.screenHeight, width: info?.screenWidth}
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
        qg.onShow(listener)
    }

    onHide(listener: OnHideListener) {
        qg.onHide(listener)
    }

    getLaunchOptionsSync(): LaunchData {
        let launchData = {} as LaunchData
        let data = qg.getLaunchOptionsSync()
        launchData.query = data?.query
        return launchData
    }

    async getLaunchOptionsAsync(): Promise<LaunchData> {
        let launchData = {} as LaunchData
        let data = qg.getLaunchOptionsSync()
        launchData.query = data?.query
        return launchData
    }
    
    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return false
    }

    adUsable() {
        return true
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

    createBannerAd(adUnitId: string, adIntervals: number, style: any) {
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
    
    getAdUnitId(key: AdUnitIdKey) {


    
        return ''
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
                qg.getOAID({
                    success: function (data) {
                        resolve(data.oaid)
                    },
                    fail: function (data, code) {
                        resolve(null)
                    },
                });
            })
        }

        let getVersionName = () => {
            return new Promise<any>(async (resolve) => {
                qg.getInstalledPackageInfo({
                    package:"com.glorious.outdanger.huawei",
                    success: function (res) {
                        if (res.versionName) {
                            resolve(res.versionName)
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
        let versionName = await getVersionName()

        let version = '1.0.0'
        if (versionName ) {
            version = versionName
        }

        let info = {} as SystemInfo
        info.appKey = 'com.glorious.outdanger.huawei'
        info.oaid = await getDeviceId()
        info.brand = 'HuaWei'
        info.version = version
        return info
    }

    showToast(text: string, icon?: "success" | "error" | "loading" | "none") {
        qg.showToast({ title: text, icon: icon });
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
                console.error('[XMLHttpRequest] load error', oReq.status, oReq.responseText)
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
            }
        });
        oReq.addEventListener("error", (res)=>{
            console.error('[XMLHttpRequest] error', JSON.stringify(res))
            if (data.fail){
                data.fail({success: false, data: null })
            }
        });

        oReq.addEventListener("abort", (res)=>{
            console.error('[XMLHttpRequest] abort', JSON.stringify(res))
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
        qg.launchNativeApp(appid)
    }

    exitApplication(data: any) {
        qg.exitApplication(data)
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
                  complete: function () {
                    callback(false)
                  },
                });
              }else{
                callback(false)
              }
            },
            fail: function (err) {
                callback(false)
            },
            complete: function () {
                callback(false)
            },
        });
    }
    
    createNativeAd(adUnitId: string, style?: any) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createNativeAd) {
            return null
        }

        return qg.createNativeAd({ adUnitId: adUnitId})
    }

    openUrl(uri: string) {
        qg.openDeeplink({uri: uri})
    }

    uploadPageOpenEvent(pageName: string): void {
        console.log('uploadPageOpenEvent:', pageName)
    }

}