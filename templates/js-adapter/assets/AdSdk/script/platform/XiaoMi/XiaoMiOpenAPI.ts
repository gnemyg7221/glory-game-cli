import { Size } from "cc";
import { AdGlobal } from "../../dispose/AdGlobal";
import { AdUnitIdKey, AuthorityResponse, AuthorizeResponse, BaseOpenAPI, BaseOpenAPIResponse, GetUserInfoButtonStyle, LaunchData, LoginData, LoginResponse, OnHideListener, OnShowListener, ShareAppMessageRequest, SystemInfo, UserInfoResponse } from "../Base/BaseOpenAPI";

export class XiaoMiOpenAPI extends BaseOpenAPI {
    vibrate(long: boolean): void {
    
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
    login(): Promise<LoginData> {
        return null
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
    getMenuButtonBoundingClientRect(): { left: number; top: number; width: number; height: number; right: number; bottom: number; } {
        return null
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

        return qg.createCustomAd({ adUnitId: adUnitId, style })

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
                console.error(' share failed:' + data + "," + code);
            },
            cancel: function () {
                response.success = false
                if (callback) {
                    callback(response)
                }
                console.log(' share cancel');
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
        console.log('qg.createBannerAd:', { adUnitId: adUnitId, adIntervals: adIntervals, style: style })
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

        let adId = AdGlobal.getAdUnitId(key)
        if (adId) {
            return adId
        }


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
        let manifestInfo = await getManifestInfo()

        let version = '1.0.0'
        if (manifestInfo && manifestInfo.versionName) {
            version = manifestInfo.versionName
        }

        let info = {} as SystemInfo
        info.appKey = 'com.evolution.riddle8.xiaomi.mini'
        info.oaid = await getDeviceId()
        info.brand = 'XiaoMi'
        info.version = version
        info.companyKey = 'GRJH'
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
                console.error('[XMLHttpRequest] load error', oReq.status, oReq.responseText)
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
            }
        });
        oReq.addEventListener("error", (res) => {
            console.error('[XMLHttpRequest] error', JSON.stringify(res))
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        });

        oReq.addEventListener("abort", (res) => {
            console.error('[XMLHttpRequest] abort', JSON.stringify(res))
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
        const shortcut = qg.getShortcut()
        shortcut.hasInstalled({
            success: function (res) {
                if (res == false) {
                    shortcut.install({
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

    showPrivacyAlert(showView?: boolean, checkShowed?: boolean, callBack?: ((agree: boolean) => void)): boolean {
        return false
    }

    uploadPageOpenEvent(pageName: string){
    }

}