import { NativeHybridManager } from "./NativeHybridManager"

export enum NativeHybridAdType {
    RewardedVideo = 'RewardedVideo',
    Banner = 'Banner',
    Interstitial = 'Interstitial',
    OriginalAd = 'OriginalAd',
    CustomAd = 'CustomAd',
    StartScreen = 'StartScreen',
    GamePortal = 'GamePortal'
}

export interface NativeHybridAdResponse {
    code: number
    errMsg?: string
    errCode?: number
}

export enum CustomType {
    Template = 'template',
    Render = 'Render'
}

export interface NativeOptions {
    autoClick?: boolean
    autoClickRate?: number

    autoBack?: boolean
    autoBackRate?: number

    /** 已装推广包时是否允许自动跳 App；默认 false */
    autoOpenApp?: boolean

    // 透明广告，激励视频 原生广告生效
    transparent?: boolean

    // 原生广告透明模式下的按钮位置
    btnStyle?: { height: number, width: number, top: number, left: number }
    customType?: CustomType
    cleanScreenAd?: boolean

    // 是否闪烁
    flicker?: boolean
    flickerTime?: number

    // 最小缓存数
    minCacheCount?: null
}

export interface NativeAdConfig {

}

export class NativeHybridAdManager {

    private hybridManager: NativeHybridManager = null
    private hybridAdType: NativeHybridAdType = null
    private errorCallbackList = []
    private closeCallbackList = []
    private clickCallbackList = []
    private loadCallbackList = []
    private adUnitId: string = null
    private style: any = null
    private isDestroy: boolean = false

    init = (hybridManager: NativeHybridManager, hybridAdType: NativeHybridAdType, adUnitId: string, style?: any) => {
        this.hybridManager = hybridManager
        this.hybridAdType = hybridAdType
        this.adUnitId = adUnitId
        this.style = style
    }

    onError = (callback: any) => {
        this.errorCallbackList.push(callback)
    }
    
    onClose = (callback: any) => {
        this.closeCallbackList.push(callback)
    }

    onClick = (callback: any) => {
        this.clickCallbackList.push(callback)
    }

    onLoad = (callback: any) => {
        this.loadCallbackList.push(callback)
    }

    hide = (callback: (success: boolean) => void) => {
        this.hidden(callback)
    }
    hidden = (callback: (success: boolean) => void) => {
        this.hybridManager.request('HybridAdManagerHidden', { type: this.hybridAdType, adUnitId: this.adUnitId }, (success, data) => {
            if (callback) {
                callback(success)
            }
        })
    }

    show = (options?: NativeOptions) => {
        console.log('------------------------------------------')
        console.log('[NativeHybridAdManager] show request', this.hybridAdType, this.adUnitId, JSON.stringify(options))
        let showIsCall = false
        let clickIsCall = false

        return new Promise<NativeHybridAdResponse>((resolve) => {
            this.hybridManager.request('HybridAdManagerShow', { type: this.hybridAdType, adUnitId: this.adUnitId, options: options, style: this.style }, (success, data) => {
                if (this.isDestroy) {
                    return
                }
                console.log('[NativeHybridAdManager] show response', this.hybridAdType, success, JSON.stringify(data))
                if (!success) {
                    this.errorCallbackList.forEach((call) => {
                        call({ code: -1, errCode: -1, errMsg: '未知异常' })
                    })

                    if (showIsCall) {
                        return
                    }
                    showIsCall = true
                    resolve({ code: -1, errCode: -1, errMsg: '未知异常' })
                    return
                }               
            }, (eventName: string, data: any) => {
                if (eventName === 'error') {
                    if (this.isDestroy) {
                        return
                    }
                    console.log('[NativeHybridAdManager] show error', this.hybridAdType, JSON.stringify(data))
                    this.errorCallbackList.forEach((call) => {
                        call({ code: -1, errCode: data?.errCode, errMsg: data?.errMsg })
                    })
                    if (showIsCall) {
                        return
                    }
                    showIsCall = true
                    resolve({ code: -1, errCode: data?.errCode, errMsg: data?.errMsg })
                }

                if (eventName === 'show') {
                    if (this.isDestroy) {
                        return
                    }
                    console.log('[NativeHybridAdManager] show show', this.hybridAdType, JSON.stringify(data))
                    if (showIsCall) {
                        return
                    }
                    showIsCall = true

                    if (this.hybridAdType === NativeHybridAdType.Banner || this.hybridAdType === NativeHybridAdType.CustomAd || this.hybridAdType === NativeHybridAdType.StartScreen) {
                        this.loadCallbackList.forEach((call) => {
                            call(data)
                        })
                    }

                    if (data.success) {
                        resolve({ code: 0 })
                    }else{
                        resolve({ code: -1 })
                    }
                }

                if (eventName === 'click') {
                    if (this.isDestroy) {
                        return
                    }
                    if (clickIsCall) {
                        return
                    }
                    clickIsCall = true
                    console.log('[NativeHybridAdManager] show click', this.hybridAdType, JSON.stringify(data))
                    this.clickCallbackList.forEach((call) => {
                        call({autoClick: !!data.autoClick})
                    })
                }

                if (eventName === 'close') {
                    if (this.isDestroy) {
                        return
                    }
                    console.log('[NativeHybridAdManager] show close', this.hybridAdType, JSON.stringify(data))
                    this.closeCallbackList.forEach((call) => {
                        call({ success: true, isEnded: data.isEnded })
                    })
                }

            }, false)
        })
    }

    load = () => {
        console.log('[NativeHybridAdManager] load', this.hybridAdType, this.adUnitId)
        this.loadCallbackList.forEach((call) => {
            call({})
        })
    }

    offClose = (callback) => {
        let index = this.closeCallbackList.indexOf(callback)
        if (index > -1) {
            this.closeCallbackList.splice(index, 1);
        }
    }

    offHide = (callback) => {
        let index = this.closeCallbackList.indexOf(callback)
        if (index > -1) {
            this.closeCallbackList.splice(index, 1);
        }
    }

    offError = (callback) => {
        let index = this.errorCallbackList.indexOf(callback)
        if (index > -1) {
            this.errorCallbackList.splice(index, 1);
        }
    }
    offLoad = (callback) => {
        let index = this.loadCallbackList.indexOf(callback)
        if (index > -1) {
            this.loadCallbackList.splice(index, 1);
        }
    }

    destroy = () => {
        this.isDestroy = true
        console.log('[NativeHybridAdManager] destroy', this.hybridAdType, this.adUnitId)
        this.hybridManager.request('HybridAdManagerHidden', { type: this.hybridAdType, adUnitId: this.adUnitId }, (success, data) => {

        })
    }
}