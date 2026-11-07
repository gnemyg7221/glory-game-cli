import { Size } from "cc";
import { AdGlobal } from "../../dispose/AdGlobal";
import { AdUnitIdKey, BaseOpenAPI, BaseOpenAPIResponse, LaunchData, LoginData, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo } from "../Base/BaseOpenAPI";

// adb push /Users/rocyang/WorkSpace/Project/GuangRongJinHua/CrazyPlumber/build/honor-minigame/dist/com.evolution.crazyplumber.minigame.rpk /sdcard/Download/
// devtools://devtools/bundled/inspector.html?v8only=true&ws=192.168.0.110:5086/00010002-0003-4004-8005-000600070008
// minigame pack release
export class RongYaoOpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
    
    }
    needPrivacyAlert(): boolean {
        return true
    }
    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return false
    }
    createScreenAd(adUnitId: string) {
        
    }
    createNativeAd(adUnitId: string, style?: any) {
        if (!qg.createSelfRenderAd) {
            return
        }
        return qg.createSelfRenderAd({ adUnitId: adUnitId, style: style })
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
        return qg.getMenuButtonBoundingClientRect();
    }
    showShare(): boolean {
        return false
    }
    createGamePortalAd(adUnitId: string, multiton: boolean) {
       if (!qg.createPortalBoxAd) {
            return null
        }

        return qg.createPortalBoxAd({ adUnitId: adUnitId })
    }
    createCustomAd(adUnitId: string, style: any) {
        if (!this.adUsable()) {
            return null
        }

        if (!qg.createNativeAd) {
            return null
        }

        return qg.createNativeAd({ adUnitId: adUnitId, style })

    }
    getScreenSize(): { width: number; height: number; } {
        let info = qg.getSystemInfoSync()
        return { height: info?.screenHeight, width: info?.screenWidth }
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

    showPrivacy(): boolean {
        return true
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
    // [{"key":"StartScreen1","appId":"2079599047777058816","type":"StartScreen","icomePlatform":"RongYao"},{"key":"Rewarded1","appId":"2079599047777058816","type":"Rewarded","icomePlatform":"RongYao"},{"key":"Rewarded2","appId":"2079599047777058816","type":"Rewarded","icomePlatform":"RongYao"},{"key":"Rewarded3","appId":"2079599047777058816","type":"Rewarded","icomePlatform":"RongYao"},{"key":"Rewarded4","appId":"2079599047777058816","type":"Rewarded","icomePlatform":"RongYao"},{"key":"Rewarded5","appId":"2079599047777058816","type":"Rewarded","icomePlatform":"RongYao"},{"key":"GameActionRewarded","appId":"2079599047777058816","type":"Rewarded","icomePlatform":"RongYao"},{"key":"CustomTemplateAd1","appId":"2079599047777058816","type":"CustomAd","icomePlatform":"RongYao"},{"key":"HomeShowCustomAd","appId":"CustomTemplateAd2","type":"CustomAd","icomePlatform":"RongYao"},{"key":"CustomTemplateAd3","appId":"2079599047777058816","type":"CustomAd","icomePlatform":"RongYao"},{"key":"CustomTemplateAd4","appId":"2079599047777058816","type":"CustomAd","icomePlatform":"RongYao"},{"key":"Banner1","appId":"2079599047777058816","type":"Banner","icomePlatform":"RongYao"}]
    getAdUnitId(key: AdUnitIdKey) {

        let adId = AdGlobal.getAdUnitId(key)
        if (adId) {
            return adId
        }
        
        return ''
    }

    setStorage(key: string, data: string, encrypt: boolean, callback: (success: boolean) => void) {
        localStorage.setItem(key, data);
        qg.setStorage({
            key: key,
            data: data,
            encrypt: encrypt,
            success() {
              callback && callback(true)
            },
            fail(){
              callback && callback(false)
            }
          })
    }
    getStorage(key: string, encrypt: boolean, callback: (success: boolean, data: any) => void) {
        qg.getStorage({
            key: key,
            encrypt: encrypt, // 若开启加密存储，setStorage 和 getStorage 需要同时声明 encrypt 的值为 true
            success(res) {
                callback && callback(true, res.data)
            },
            fail(){
                callback && callback(false, null)
            }
          })

    }

    async getSystemInfo() {
        let getDeviceId = () => {
            return new Promise<string>(async (resolve) => {
                if (!qg.getDeviceId) {
                    resolve(null)
                    return
                }
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
                if (!qg.getManifestInfo) {
                    resolve(null)
                    return
                }

                qg.getManifestInfo({
                    success: function (res) {
                        if (res.manifest) {
                            resolve(JSON.parse(res.manifest))
                        } else {
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
        if (manifestInfo && manifestInfo.versionName) {
            version = manifestInfo.versionName
        }

        let packageName = 'com.null.minigame'
        if (manifestInfo && manifestInfo.package) {
            packageName = manifestInfo.package
        }

        let info = {} as SystemInfo
        info.appKey = packageName
        info.oaid = await getDeviceId()
        info.brand = 'RongYao'
        info.version = version
        info.companyKey = 'GRJH'
        info.platformVersionCode = systemInfo?.platformVersionCode
        return info
    }

    showToast(text: string, icon?: "success" | "error" | "loading" | "none") {
        qg.showToast({ title: text, icon: icon });
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
                AdGlobal.canLog && console.error('[XMLHttpRequest] load error', oReq.status, oReq.responseText)
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
            }
        });
        oReq.addEventListener("error", (res) => {
            AdGlobal.canLog && console.error('[XMLHttpRequest] error', JSON.stringify(res))
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        });

        oReq.addEventListener("abort", (res) => {
            AdGlobal.canLog && console.error('[XMLHttpRequest] abort', JSON.stringify(res))
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

    installShortcut(callback: (success: any) => void): void {
        qg.hasShortcutInstalled({
            success: function (status) {
                if (status == false) {
                    qg.installShortcut({
                        message: '创建桌面图标，游戏体验更佳！',
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
                } else {
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

    uploadPageOpenEvent(pageName: string){
    }
}