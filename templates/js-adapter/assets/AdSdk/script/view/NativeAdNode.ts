
import { _decorator, Button, Component, instantiate, Label, Layout, Node, Sprite, UITransform, view, Widget } from 'cc';
import { AdGlobal, ShowMoreAdType } from '../dispose/AdGlobal';
import ResMgr from '../manager/ResMgr';
import { EventType, NetWorkManager } from '../network/NetWorkManager';
import { AdUnitIdKey } from '../platform/Base/BaseOpenAPI';
import { AdSpaceType, AdUtils } from '../utils/AdUtils';
import { OpenAPIManager } from '../platform/OpenAPIManager';
const { ccclass, property } = _decorator;

// 1：文字
// 2：大图片
// 3：大图文
// 4：GIF
// 6：视频文
// 7：小图文
// 8：三小图文
// 9：视频
// 10：图标（文）
// 103：大图文带下载按钮
// 106：视频文带下载按钮
// 107：小图文带下载按钮
// 108：三小图文带下载按钮
// 102：大图片带下载按钮
// 101：文字带下载按钮
// 110：图标（文）带下载按钮

export enum NativeAdNodeStyle {
    Top = 'Top',
    Middle = 'Middle',
    Bottom = 'Bottom'
}

export enum AdShowStyle {
    OnlyBtn = 'OnlyBtn', // 仅展示下载Btn
    DownloadView = 'DownLoadView', // 展示下载View
    AllView = 'AllView' // 展示所有View
}

export enum ButtonStyle {
    Normal = 'Normal',
    Lucency = 'Lucency'
}

export enum AppState {
    DOWNLOAD = 'DOWNLOAD',
    WAITING = 'WAITING',
    INSTALLED = 'INSTALLED',
    DOWNLOADFAILED = 'DOWNLOADFAILED'
}

export interface NativeAdData {
    adId: string
    title: string
    source: string
    icon: string
    imgUrlList: string[]
    videoUrlList: string[]
    videoRatio: any[]
    logoUrl: string
    clickBtnTxt: string
    creativeType: number
    interactionType: number
    appName: string
    versionName: string
    developerName: string
    appDetailUrl: string
    permissionUrl: string
    privacyUrl: string
}

export interface ShowAdData {
    nativeAd: any
    adKey: string
    subKey: AdUnitIdKey
    data: NativeAdData
    appState?: AppState

    needShowBtn: boolean
    btnShowed: boolean
    detailView?: NativeAdNode

    viewIsClick: boolean
    ecpm: number
}

const SHOW_LOG = false

export class NativeAdManager {

    private static _inst: NativeAdManager;
    public static get inst(): NativeAdManager {
        if (this._inst == null) {
            this._inst = new NativeAdManager();
        }
        return this._inst;
    }

    private currentShowAd: ShowAdData = null
    private nativeContentNode: Node = null
    private downloadAppName: string[] = []
    private willShowAdList: ShowAdData[] = []
    private willDestroyList: ShowAdData[] = []
    private inQueryKeyList: AdUnitIdKey[] = []

    private btnNode: Node = null
    private nativeAdNodeStyle: NativeAdNodeStyle = null
    private adShowStyle: AdShowStyle = null
    private showCount = 0
    private needShowCount = 0

    private downloadCount = 0
    private needDownloadCount = 10

    private queryNullCount = 0
    private maxQueryNullCount = 20

    private isRun = false
    private queryTimer = null

    private callback: (success: boolean) => void


    init = (node: Node) => {
        this.nativeContentNode = node
    }

    nativeAdIsShow = () => {
        return !!this.currentShowAd
    }

    nativeAdIsClick = () => {
        return this.currentShowAd?.viewIsClick || this.currentShowAd?.btnShowed
    }

    nativeAdOnHide = () => {
        if (this.currentShowAd && this.adShowStyle === AdShowStyle.OnlyBtn && this.currentShowAd.appState !== AppState.INSTALLED) {
            this.closeNativeAd(this.currentShowAd)
        }
    }

    public show = async (adKey: string, subKeyList: AdUnitIdKey[], adShowStyle: AdShowStyle, nativeAdNodeStyle: NativeAdNodeStyle, btnNode: Node, showCount: number, refreshCount: number, callback: (success: boolean) => void) => {
        AdGlobal.canLog && console.log('[NativeAdManager] show', adKey, subKeyList)
        this.callback = callback
        this.needShowCount = showCount
        this.maxQueryNullCount = refreshCount
        this.btnNode = btnNode
        this.nativeAdNodeStyle = nativeAdNodeStyle
        this.adShowStyle = adShowStyle

        if (!adKey || !subKeyList.length) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.NativeAd, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-1', 'radUsable is false' + `[类型: 激励 brand: ${AdGlobal.brand} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
            callback(false)
            return
        }
        // 有正在执行，先清空之前任务
        if (this.isRun) {
            this.clean()
            await AdUtils.timeOut(2000)
        }

        this.isRun = true

        // 先展示预加载的数据，没有的话再请求
        if (this.willShowAdList.length > 0) {
            this.checkShowAdView(btnNode, nativeAdNodeStyle)
        } else {
            SHOW_LOG && console.log('[NativeAdManager] 开始一轮广告并行请求')
            let success = await this.refreshAdDataParallel(adKey, subKeyList, adShowStyle)
            if (success) {
                this.checkShowAdView(btnNode, nativeAdNodeStyle)
            }
        }

        // 请求广告数据
        this.queryTimer = setInterval(async () => {
            if (!this.isRun) {
                return
            }

            // SHOW_LOG && console.log('[NativeAdManager] 开始一轮广告串行请求', this.showCount, this.needShowCount, '|',this.downloadCount, this.needDownloadCount, '|', this.queryNullCount, this.maxQueryNullCount) 
            if (this.showCount >= this.needShowCount || this.downloadCount >= this.needDownloadCount || this.queryNullCount >= this.maxQueryNullCount) {
                if (!this.currentShowAd && this.willShowAdList.length === 0) {
                    this.closeNativeAd(null)
                }
                return
            }

            await this.refreshAdDataSerial(adKey, subKeyList, adShowStyle, false, async () => {
                let showViewSuccess = await this.checkShowAdView(btnNode, nativeAdNodeStyle)
                SHOW_LOG && console.log('[NativeAdManager] checkShowAdView:', showViewSuccess)
            })
        }, 2000)
    }

    public preloadAdData = async (adKey: string, subKeyList: AdUnitIdKey[], adShowStyle: AdShowStyle) => {
        SHOW_LOG && console.log('[NativeAdManager] preloadAdData:', adKey, subKeyList)
        let success = await this.refreshAdDataSerial(adKey, subKeyList, adShowStyle, true)
        if (success) {
            SHOW_LOG && console.log('[NativeAdManager] preloadAdData:', success)
        }
    }

    public clean = () => {
        if (this.queryTimer) {
            clearInterval(this.queryTimer)
        }

        this.showCount = 0
        this.downloadCount = 0
        this.queryNullCount = 0

        this.callback = null

        if (this.currentShowAd) {
            this.closeNativeAd(this.currentShowAd)
        }

        this.isRun = false
    }

    // 并行刷新数据
    private refreshAdDataParallel = (adKey: string, subKeyList: AdUnitIdKey[], adShowStyle: AdShowStyle) => {
        return new Promise<boolean>(async (resolve) => {
            let queryTaskList: Promise<ShowAdData>[] = []
            subKeyList.forEach((subKey, index) => {

                let willShowAdData = this.subKeyWillShow(subKey)
                if (willShowAdData) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataParallel 以准备好，跳过：', subKey, willShowAdData?.data?.appName)
                    return
                }

                let willDestroyAdData = this.subKeyWillDestroy(subKey)
                if (willDestroyAdData) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataParallel 准备释放，跳过：', subKey, willDestroyAdData.data?.appName)
                    return
                }

                if (this.subKeyInQuery(subKey)) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataParallel 已加载中，跳过：', subKey)
                    return
                }

                queryTaskList.push(this.queryNativeAdData(adKey, subKey, index * 100))
                this.inQueryKeyList.push(subKey)

            })

            let nativeDataInfoList = await Promise.all(queryTaskList)
            SHOW_LOG && console.log('[NativeAdManager] refreshAdDataParallel showAdDataList count:', nativeDataInfoList.length)
            for (let index = 0; index < nativeDataInfoList.length; index++) {
                const showAdData = nativeDataInfoList[index];
                this.inQueryKeyList = this.inQueryKeyList.filter(key => key !== showAdData.subKey);
                if (!showAdData.data) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataParallel showAdData is Null!', JSON.stringify(showAdData))
                    if (showAdData.nativeAd) {
                        this.willDestroyList.push(showAdData)
                    }
                    this.queryNullCount++
                    continue
                }

                let queryIsNull = true
                let type = this.checkAdDataType(showAdData)
                if (adShowStyle === AdShowStyle.AllView) {
                    if (type === AppState.DOWNLOAD) {
                        showAdData.needShowBtn = true
                        this.downloadAppName.push(showAdData.data.appName)
                    } else {
                        showAdData.needShowBtn = false
                    }
                    this.reportAdShow(showAdData)
                    this.willShowAdList.push(showAdData)
                    queryIsNull = false
                } else if (adShowStyle === AdShowStyle.DownloadView) {
                    if (type === AppState.DOWNLOAD) {
                        showAdData.needShowBtn = true
                        this.willShowAdList.push(showAdData)
                        this.downloadAppName.push(showAdData.data.appName)
                        queryIsNull = false
                    } else {
                        this.reportAdShow(showAdData)
                        this.willDestroyList.push(showAdData)
                    }
                } else if (adShowStyle === AdShowStyle.OnlyBtn) {
                    if (type === AppState.DOWNLOAD) {
                        showAdData.needShowBtn = true
                        this.willShowAdList.push(showAdData)
                        this.downloadAppName.push(showAdData.data.appName)
                        queryIsNull = false
                    } else {
                        this.reportAdShow(showAdData)
                        this.willDestroyList.push(showAdData)
                    }
                }
                if (queryIsNull) {
                    this.queryNullCount++
                }

            }
            resolve(true)
            // 广告销毁
            setTimeout(() => {
                for (let index = 0; index < this.willDestroyList.length; index++) {
                    const adData = this.willDestroyList[index];
                    this.destroyAd(adData)
                }
                this.willDestroyList = []
            }, 3000);
        })
    }

    // 串行刷新数据
    private refreshAdDataSerial = (adKey: string, subKeyList: AdUnitIdKey[], adShowStyle: AdShowStyle, preload: boolean = false, addAdCallback?: () => void) => {
        return new Promise<boolean>(async (resolve) => {
            for (let index = 0; index < subKeyList.length; index++) {
                const subKey = subKeyList[index];
                let willShowAdData = this.subKeyWillShow(subKey)
                if (willShowAdData) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataSerial 以准备好，跳过：', subKey, willShowAdData?.data?.appName)
                    continue
                }

                let willDestroyAdData = this.subKeyWillDestroy(subKey)
                if (willDestroyAdData) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataSerial 准备释放，跳过：', subKey, willDestroyAdData.data?.appName)
                    continue
                }

                if (this.subKeyInQuery(subKey)) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataSerial 已加载中，跳过：', subKey)
                    continue
                }

                this.inQueryKeyList.push(subKey)
                let showAdData = await this.queryNativeAdData(adKey, subKey)
                this.inQueryKeyList = this.inQueryKeyList.filter(key => key !== subKey);

                if (!showAdData || !showAdData.data) {
                    SHOW_LOG && console.log('[NativeAdManager] refreshAdDataSerial is Null！:', subKey)
                    if (showAdData.nativeAd) {
                        this.willDestroyList.push(showAdData)
                    }
                    this.queryNullCount++
                    continue
                }
                SHOW_LOG && console.log('[NativeAdManager] refreshAdDataSerial showAdData:', showAdData?.data.appName)
                let queryIsNull = true
                let type = this.checkAdDataType(showAdData)
                if (adShowStyle === AdShowStyle.AllView) {
                    if (type === AppState.DOWNLOAD) {
                        showAdData.needShowBtn = true
                        this.downloadAppName.push(showAdData.data.appName)
                    } else {
                        showAdData.needShowBtn = false
                    }
                    this.reportAdShow(showAdData)
                    this.willShowAdList.push(showAdData)
                    addAdCallback && addAdCallback()
                    queryIsNull = false
                } else if (adShowStyle === AdShowStyle.DownloadView) {
                    if (type === AppState.DOWNLOAD) {
                        showAdData.needShowBtn = true
                        this.willShowAdList.push(showAdData)
                        this.downloadAppName.push(showAdData.data.appName)
                        addAdCallback && addAdCallback()
                        queryIsNull = false
                    } else {
                        this.reportAdShow(showAdData)
                        this.willDestroyList.push(showAdData)
                    }
                } else if (adShowStyle === AdShowStyle.OnlyBtn) {
                    if (type === AppState.DOWNLOAD) {
                        showAdData.needShowBtn = true
                        this.willShowAdList.push(showAdData)
                        this.downloadAppName.push(showAdData.data.appName)
                        addAdCallback && addAdCallback()
                        queryIsNull = false
                    } else {
                        this.reportAdShow(showAdData)
                        this.willDestroyList.push(showAdData)
                    }
                }

                if (queryIsNull && !preload) {
                    this.queryNullCount++
                }
            }
            resolve(true)
            setTimeout(() => {
                for (let index = 0; index < this.willDestroyList.length; index++) {
                    const adData = this.willDestroyList[index];
                    this.destroyAd(adData)
                }
                this.willDestroyList = []
            }, 3000);
        })
    }

    private subKeyWillShow = (subKey: string) => {

        if (this.currentShowAd && this.currentShowAd.subKey === subKey) {
            return this.currentShowAd
        }

        for (let index = 0; index < this.willShowAdList.length; index++) {
            const showAdData = this.willShowAdList[index];
            if (showAdData.subKey === subKey) {
                return showAdData
            }
        }
        return null
    }

    private subKeyWillDestroy = (subKey: string) => {
        for (let index = 0; index < this.willDestroyList.length; index++) {
            const showAdData = this.willDestroyList[index];
            if (showAdData.subKey === subKey) {
                return showAdData
            }
        }
        return null
    }

    private subKeyInQuery = (subKey: string) => {
        for (let index = 0; index < this.inQueryKeyList.length; index++) {
            const key = this.inQueryKeyList[index];
            if (key === subKey) {
                return true
            }
        }
        return false
    }

    private checkShowAdView = async (node: Node, nodeStyle: NativeAdNodeStyle) => {

        if (!this.isRun) {
            SHOW_LOG && console.log('[NativeAdManager] checkShowAdView 当前任务已暂停')
            return false
        }

        let adLogInfo = 'current:' + this.currentShowAd?.subKey + '-' + this.currentShowAd?.data?.appName + ',willShow:'
        this.willShowAdList.forEach((data) => {
            adLogInfo = adLogInfo + data.subKey + '-' + data.data.appName + ','
        })

        SHOW_LOG && console.log('[NativeAdManager] checkShowAdView 开始处理View相关逻辑:', adLogInfo)
        if (this.willShowAdList.length === 0) {
            AdGlobal.canLog && console.log('[NativeAdManager] checkShowAdView 当前没有可展示广告')
            return false
        }

        if (this.currentShowAd) {
            AdGlobal.canLog && console.log('[NativeAdManager] checkShowAdView 当前有正在展示的广告', this.currentShowAd.data.appName)
            return false
        }

        let showAdData: ShowAdData = null
        // 先优先寻找可下载的展示
        for (let index = 0; index < this.willShowAdList.length; index++) {
            const adData = this.willShowAdList[index];
            if (adData.needShowBtn) {
                showAdData = adData
                break
            }
        }

        if (showAdData) {
            this.willShowAdList = this.willShowAdList.filter(key => key !== showAdData);
        } else {
            showAdData = this.willShowAdList.pop()
        }

        let needShowDetail = true
        if (this.adShowStyle === AdShowStyle.OnlyBtn) {
            needShowDetail = false
        }

        this.currentShowAd = showAdData

        // 显示DetailView
        if (needShowDetail) {
            SHOW_LOG && console.log('[NativeAdManager] checkShowAdView 展示View中', showAdData.subKey, showAdData.data?.appName)
            let success = await this.showDetailView(showAdData, nodeStyle)
            AdGlobal.canLog && console.log('[NativeAdManager] checkShowAdView 展示View完成', success, showAdData.data.appName)
            if (!success) {
                this.closeNativeAd(showAdData)
                return false
            }
        }

        if (showAdData.needShowBtn) {
            AdGlobal.canLog && console.log('[NativeAdManager] checkShowAdView 展示按钮中', showAdData.subKey, showAdData.data?.appName)
            let btnStyle = ButtonStyle.Lucency
            let btnNode = node

            if (showAdData.detailView) {
                btnStyle = ButtonStyle.Normal
                btnNode = showAdData.detailView.getClickBtnNode()
            }

            let showBtnSuccess = await this.showDownloadButton(showAdData, btnNode, btnStyle)
            AdGlobal.canLog && console.log('[NativeAdManager] checkShowAdView 展示Btn完成', showBtnSuccess, showAdData.data.appName, showAdData.data.clickBtnTxt)
            if (!showBtnSuccess) {
                this.closeNativeAd(showAdData)
                return false
            }
            showAdData.appState = AppState.DOWNLOAD
            this.reportAdShow(showAdData)
            showAdData.btnShowed = true

            NetWorkManager.inst.uploadEventData('ad_download_show_' +  AdSpaceType.NativeAd, EventType.Frequency)

            // 开始监听下载状态变化
            showAdData.nativeAd.offStatusChanged()
            showAdData.nativeAd.onStatusChanged((res: any) => {
                AdGlobal.canLog && console.log('[NativeAdManager] showAdBtn 安装状态改变：', res.status, showAdData.data.appName)

                if (showAdData.appState === AppState.DOWNLOAD && res.status === AppState.WAITING) {
                    AdGlobal.canLog && console.log('[NativeAdManager] showAdBtn 开始下载！', showAdData.data.appName)
                    showAdData.appState = AppState.WAITING
                    this.closeNativeAd(showAdData, false)
                    // 开始下载额外收益
                    AdUtils.adIncome = AdUtils.adIncome + showAdData.ecpm
                    NetWorkManager.inst.uploadEventData('ad_download_all', EventType.Frequency)
                    NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.NativeAd , EventType.Number, showAdData.ecpm * 5)
                }

                if (showAdData.appState !== res.status && res.status === AppState.INSTALLED) {
                    AdGlobal.canLog && console.log('[NativeAdManager] showAdBtn 下载完成！', showAdData.data.appName)
                    showAdData.appState = AppState.INSTALLED

                    if (AdGlobal.adType === ShowMoreAdType.HIGH) {
                        if (!this.currentShowAd) {
                            this.currentShowAd = showAdData
                        }
                        this.adClick(showAdData)
                        setTimeout(() => {
                            this.closeNativeAd(showAdData)
                        }, 1000);
                    } else {
                        // 判断是否打开详情
                        if (!this.currentShowAd) {
                            this.currentShowAd = showAdData
                            if (showAdData && showAdData.data && showAdData.data.clickBtnTxt) {
                                showAdData.data.clickBtnTxt = '打开'
                            }
                            this.showDetailView(showAdData, NativeAdNodeStyle.Middle).then((success) => {
                                if (!success) {
                                    this.closeNativeAd(showAdData)
                                }
                            })
                        }
                    }

                    // 下载成功额外收益
                    AdUtils.adIncome = AdUtils.adIncome + showAdData.ecpm
                    NetWorkManager.inst.uploadEventData('ad_download_success_all' , EventType.Frequency)
                    NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.NativeAd , EventType.Number, showAdData.ecpm * 20)                    
                    this.downloadCount++
                }

                if (showAdData.appState !== res.status && res.status === AppState.DOWNLOADFAILED) {
                    SHOW_LOG && console.log('[NativeAdManager] showAdBtn 下载失败！', showAdData.data.appName)
                    showAdData.appState = AppState.DOWNLOADFAILED
                    this.closeNativeAd(showAdData)
                    NetWorkManager.inst.uploadEventData('ad_download_failed_' +  AdSpaceType.NativeAd, EventType.Frequency)
                }

            })
        } else {
            showAdData.appState = AppState.INSTALLED
        }
        SHOW_LOG && console.log('[NativeAdManager] checkShowAdView 结束处理View相关逻辑')
        this.showCount++
        return true
    }

    private checkAdDataType = (showAdData: ShowAdData) => {
        if (this.downloadAppName.indexOf(showAdData.data.appName) !== -1) {
            SHOW_LOG && console.log('[NativeAdManager] checkAdDataType 重复App:', showAdData.data.appName, showAdData.subKey)
            return AppState.INSTALLED
        }

        let appState = showAdData.nativeAd.getAppStatus({ adId: showAdData.data.adId })
        if (appState === AppState.DOWNLOAD && this.isDownloadAd(showAdData) && showAdData.data.clickBtnTxt === '安装') {
            SHOW_LOG && console.log('[NativeAdManager] checkAdDataType 可下载App:', showAdData.data.appName, showAdData.subKey, showAdData.data.clickBtnTxt)
            return AppState.DOWNLOAD
        } else {
            SHOW_LOG && console.log('[NativeAdManager] checkAdDataType 可打开App:', showAdData.data.appName, showAdData.subKey, showAdData.data.clickBtnTxt)
            return AppState.INSTALLED
        }
    }

    private isDownloadAd = (showAdData: ShowAdData) => {
        return showAdData.data.creativeType > 99
    }

    private reportAdShow = (showAdData: ShowAdData) => {
        if (showAdData.nativeAd && showAdData?.data?.adId) {
            SHOW_LOG && console.log('[NativeAdManager] 广告曝光:', showAdData?.data?.appName)
            showAdData.nativeAd.reportAdShow({ adId: showAdData?.data?.adId })

            AdUtils.adShowCount++
            AdUtils.adIncome = AdUtils.adIncome + showAdData.ecpm
            NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.NativeAd, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.NativeAd , EventType.Number, showAdData.ecpm)
        }
    }

    public closeNativeAd = (showAdData: ShowAdData, needDestroy: boolean = true) => {
        if (showAdData?.detailView) {
            showAdData.detailView.node.active = false
            showAdData.detailView.node.removeFromParent()
            showAdData.detailView = null
        }

        if (showAdData?.btnShowed) {
            this.hiddenDownloadButton(showAdData)
            showAdData.btnShowed = false
        }

        if (needDestroy && showAdData) {
            this.destroyAd(showAdData)
        }
        this.currentShowAd = null

        if (this.showCount >= this.needShowCount || this.downloadCount >= this.needDownloadCount) {
            AdGlobal.canLog && console.log('[NativeAdManager] closeNativeAd 原生广告关闭 任务成功', showAdData?.data.appName)
            this.callback && this.callback(true)
            this.clean()
            return
        }

        if (this.queryNullCount >= this.maxQueryNullCount && !this.currentShowAd && this.willShowAdList.length === 0) {
            AdGlobal.canLog && console.log('[NativeAdManager] closeNativeAd 原生广告关闭 任务失败', showAdData?.data.appName)
            this.callback && this.callback(false)
            this.clean()
            return
        }
        AdGlobal.canLog && console.log('[NativeAdManager] closeNativeAd 原生广告关闭 执行中', showAdData?.data.appName)

        setTimeout(() => {
            this.checkShowAdView(this.btnNode, this.nativeAdNodeStyle)
        }, 100);
    }

    private destroyAd = (showAdData: ShowAdData) => {
        if (showAdData.nativeAd) {
            SHOW_LOG && console.log('[NativeAdManager] 广告销毁:', showAdData.subKey, showAdData?.data?.appName)
            showAdData.nativeAd.destroy()
        }
    }

    private queryNativeAdData = (adKey: string, subkey: AdUnitIdKey, timeout: number = 0) => {
        return new Promise<ShowAdData>(async (resolve) => {

            if (timeout) {
                await AdUtils.timeOut(timeout)
            }

            NetWorkManager.inst.uploadEventData('ad_download_request_' +  AdSpaceType.NativeAd, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_request_' +  AdSpaceType.NativeAd, EventType.Frequency)

            let showAdData = {} as ShowAdData
            showAdData.subKey = subkey
            showAdData.adKey = adKey
            showAdData.ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.NativeAd)

            if (!adKey || !subkey) {
                NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg('-3', 'adKey is null' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                resolve(showAdData)
                return
            }

            let adId = OpenAPIManager.inst.getAdUnitId(subkey);

            if (!adId) {
                NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg('-3', 'nativeAd id is null' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                resolve(showAdData)
                return
            }

            let nativeAd = OpenAPIManager.inst.createNativeAd(adId, null)

            if (!nativeAd) {
                NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg('-3', 'nativeAd error' + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                resolve(showAdData)
                return
            }

            let loadCompleted = false
            let onError = (res: any) => {
                AdGlobal.canLog && console.error('[NativeAdManager]:原生 广告显示error', adId, JSON.stringify(res))
                let errMsg = res.errMsg
                let errCode = res.errCode

                NetWorkManager.inst.uploadEventData('ad_load_error_' +  AdSpaceType.NativeAd, EventType.Frequency, 0 , { errCode: errCode, errMsg: errMsg})
                NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 原生 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                
                if (!loadCompleted) {
                    loadCompleted = true
                    showAdData.nativeAd = nativeAd
                    resolve(showAdData)
                }
            }

            let onLoad = async (data: { adList: NativeAdData[] }) => {
                if (!data || !data.adList || !data.adList.length) {
                    if (!loadCompleted) {
                        loadCompleted = true
                        showAdData.nativeAd = nativeAd
                        resolve(showAdData)
                    }
                    return
                }

                if (!loadCompleted) {
                    loadCompleted = true
                    showAdData.nativeAd = nativeAd
                    showAdData.data = data.adList[0]
                    resolve(showAdData)
                }
            }

            setTimeout(() => {
                if (!loadCompleted) {
                    loadCompleted = true
                    console.info('[NativeAdManager] setTimeout')
                    showAdData.nativeAd = nativeAd
                    resolve(showAdData)
                }
            }, 3000);

            if (nativeAd?.onError) {
                nativeAd?.onError(onError)
            }

            if (nativeAd?.onLoad) {
                nativeAd?.onLoad(onLoad)
            }

            nativeAd.load()
        })
    }

    private showDetailView = async (data: ShowAdData, style: NativeAdNodeStyle) => {
        return new Promise<boolean>(async (resolve) => {
            if (!this.nativeContentNode) {
                SHOW_LOG && console.log('[NativeAdManager] showDetailView nativeContentNode is Null!')
                resolve(false)
                return
            }

            if (this.currentShowAd?.detailView) {
                SHOW_LOG && console.log('[NativeAdManager] showDetailView 当前正在展示View!')
                resolve(false)
                return
            }

            let nativeAdNodePrefab = await ResMgr.ins.getPrefab('AdGlobalBundle', 'prefab/ui/NativeAdNode')
            if (!nativeAdNodePrefab) {
                SHOW_LOG && console.log('[NativeAdManager] showDetailView nativeAdNodePrefab is Null!')
                resolve(false)
                return
            }

            let nativeAdNode = instantiate(nativeAdNodePrefab);
            if (!nativeAdNode) {
                SHOW_LOG && console.log('[NativeAdManager] showDetailView nativeAdNode is Null!')
                resolve(false)
                return
            }

            let nativeAdView = nativeAdNode.getComponent(NativeAdNode)
            if (!nativeAdView) {
                SHOW_LOG && console.log('[NativeAdManager] showDetailView nativeAdView is Null!')
                resolve(false)
                return
            }

            data.detailView = nativeAdView
            this.nativeContentNode.addChild(nativeAdView.node)
            nativeAdView.node.active = false
            nativeAdView.show(data, style, () => {
                setTimeout(() => {
                    nativeAdView.node.active = true
                    resolve(true)
                }, 500)
            })
        })
    }

    public adClick = (data: ShowAdData) => {
        data.viewIsClick = true
        if (this.isDownloadAd(data)) {
            data.nativeAd.startDownload({ adId: data.data.adId })
        } else {
            data.nativeAd.reportAdClick({ adId: data.data.adId })
        }
        NetWorkManager.inst.uploadEventData('ad_click_' +  AdSpaceType.NativeAd, EventType.Frequency)
    }

    private hiddenDownloadButton = (data: ShowAdData) => {
        if (data.btnShowed) {
            data.nativeAd.hideDownloadButton({ adId: data.data.adId })
            data.btnShowed = false
        }
    }

    private showDownloadButton = (data: ShowAdData, node: Node, style: ButtonStyle) => {
        return new Promise<boolean>(async (resolve) => {
            let screenSizeOne = view.getVisibleSize()
            let screenSizeTwo = view.getVisibleSizeInPixel()

            if (!screenSizeOne || !screenSizeTwo) {
                return false
            }
            let scale = screenSizeTwo.width / screenSizeOne.width

            let btnW = screenSizeTwo.width
            let btnMT = 400
            let btnML = 0

            if (node) {
                let nodeSize = node.getComponent(UITransform).contentSize
                btnW = nodeSize.width * scale
                btnMT = screenSizeTwo.height - (node.worldPosition.y + 33) * scale
                btnML = (node.worldPosition.x - nodeSize.width / 2) * scale
            }

            if (style === ButtonStyle.Lucency) {
                btnW = screenSizeTwo.width
                btnML = 0
            }

            let styleData: any = {
                'normalTextColor': '#FFFFFF',
                'normalBackground': '#eebc40',
                'pressedColor': '#f9de4b',
                'normalStroke': 5,
                'normalStrokeCorlor': '#c2782a',
                'processingTextColor': '#FFFFFF',
                'processingBackground': '#f9de4b',
                'processingColor': '#f9de4b',
                'processingStroke': 5,
                'processingStrokeCorlor': '#0A59F7',
                'installingTextColor': '#FFFFFF',
                'installingBackground': '#c2782a',
                'installingStroke': 5,
                'installingStrokeCorlor': '#f9de4b'
            }
            if (style === ButtonStyle.Lucency) {
                styleData = {
                    // 'normalTextColor': '#FFFFFF',
                    // 'normalBackground': '#eebc40',
                    'normalTextColor': '#00000000',
                    'normalBackground': '#00000000',
                    'pressedColor': '#00000000',
                    'normalStroke': 5,
                    'normalStrokeCorlor': '#00000000',
                    'processingTextColor': '#00000000',
                    'processingBackground': '#00000000',
                    'processingColor': '#00000000',
                    'processingStroke': 10,
                    'processingStrokeCorlor': '#00000000',
                    'installingTextColor': '#00000000',
                    'installingBackground': '#00000000',
                    'installingStroke': 15,
                    'installingStrokeCorlor': '#00000000'
                }
            }

            data.nativeAd.showDownloadButton({
                adId: data.data.adId,
                style: {
                    left: btnML,
                    top: btnMT,
                    heightType: 'normal',
                    width: btnW,
                    fixedWidth: true,
                    textSize: 50,
                    minWidth: 200,
                    maxWidth: 500,
                    horizontalPadding: 50,
                    cornerRadius: 22,
                    normalTextColor: styleData.normalTextColor,
                    normalBackground: styleData.normalBackground,
                    normalStrokeCorlor: styleData.normalStrokeCorlor,
                    pressedColor: styleData.pressedColor,
                    normalStroke: styleData.normalStroke,
                    processingTextColor: styleData.processingTextColor,
                    processingBackground: styleData.processingBackground,
                    processingColor: styleData.processingColor,
                    processingStroke: styleData.processingStroke,
                    processingStrokeCorlor: styleData.processingStrokeCorlor,
                    installingTextColor: styleData.installingTextColor,
                    installingBackground: styleData.installingBackground,
                    installingStroke: styleData.installingStroke,
                    installingStrokeCorlor: styleData.installingStrokeCorlor
                },
                success: (code) => {
                    SHOW_LOG && console.log("[NativeAdManager] showDownloadButton: success");
                    resolve(true)
                },
                fail: (data, code) => {
                    SHOW_LOG && console.log("[NativeAdManager] showDownloadButton fail: " + data + "," + code);
                    resolve(false)
                }
            });
        })
    }
}


@ccclass('NativeAdNode')
export class NativeAdNode extends Component {

    @property({ type: Sprite })
    public adImage: Sprite | null = null;

    @property({ type: Label })
    public title: Label | null = null;

    @property({ type: Label })
    public subTitle: Label | null = null;

    @property({ type: Label })
    public versionLabel: Label | null = null;

    @property({ type: Node })
    public jieShaoNode: Node | null = null;

    @property({ type: Node })
    public contentNode: Node | null = null;

    @property({ type: Node })
    public yinsiNode: Node | null = null;

    @property({ type: Node })
    public quanxianNode: Node | null = null;

    @property({ type: Label })
    public btnLabel: Label | null = null;

    @property({ type: Node })
    public btnNode: Node | null = null;

    @property({ type: Node })
    public bgNode: Node | null = null;

    @property({ type: Widget })
    public bgWidget: Widget | null = null;

    @property({ type: Button })
    public allAdBtn: Button | null = null;

    private showAdData: ShowAdData = null
    private callback: (success: boolean) => void = null

    show = async (showAdData: ShowAdData, style: NativeAdNodeStyle, callback: (success: boolean) => void) => {
        this.showAdData = showAdData
        this.callback = callback
        this.updateUIData(this.showAdData.data, style, this.callback)
        if (AdGlobal.adType === ShowMoreAdType.HIGH && showAdData.appState === AppState.INSTALLED && Math.random() < 0.4) {
            setTimeout(() => {
                this.adClick()
                setTimeout(() => {
                    this.adClose()
                }, 1000);
            }, 3000);
        }
    }

    updateUIData = async (data: NativeAdData, style: NativeAdNodeStyle, callback: (success: boolean) => void) => {
        if (data.imgUrlList && data.imgUrlList[0]) {
            this.adImage.spriteFrame = null
            let spriteFrames = await ResMgr.ins.getSpfsWithUrl(this.showAdData.data.imgUrlList[0])
            if (spriteFrames) {
                let imageW = spriteFrames.width
                let imageH = spriteFrames.height
                let viewW = 460
                let viewH = imageH * (460 / imageW)
                this.adImage.getComponent(UITransform).setContentSize(viewW, viewH)
                this.adImage.spriteFrame = spriteFrames

                let bgHeight = 520 + (viewH - 280)
                this.bgNode.getComponent(UITransform).setContentSize(500, bgHeight)
            }
        }
        this.contentNode.getComponent(Layout).updateLayout(true)
        this.btnLabel.string = data.clickBtnTxt ?? '查看详情'

        this.title.string = data.appName ? data.appName : (data.title ? data.title : "")

        this.subTitle.string = data.developerName ? data.developerName : (data.source ? data.source : "")

        this.versionLabel.string = data.versionName ?? ''
        this.yinsiNode.active = !!data.privacyUrl
        this.quanxianNode.active = !!data.permissionUrl
        this.jieShaoNode.active = !!data.appDetailUrl

        if (style === NativeAdNodeStyle.Bottom) {
            this.bgWidget.isAlignBottom = true
            this.bgWidget.bottom = 100
        }

        if (style === NativeAdNodeStyle.Top) {
            this.bgWidget.isAlignTop = true
            this.bgWidget.top = 100
        }

        if (style === NativeAdNodeStyle.Middle) {
            this.bgWidget.isAlignVerticalCenter = true
            this.bgWidget.verticalCenter = 0
        }

        if (AdGlobal.adType === ShowMoreAdType.HIGH) {
            this.allAdBtn.node.active = true
        } else {
            this.allAdBtn.node.active = false
        }

        if (callback) {
            callback(true)
        }

        return true
    }

    getClickBtnNode = () => {
        return this.btnNode
    }

    adClick() {
        NativeAdManager.inst.adClick(this.showAdData)
    }

    allAdClick() {
        this.allAdBtn.node.active = false
        this.adClick()
    }

    adClose() {
        NativeAdManager.inst.closeNativeAd(this.showAdData)
    }

    closeView = () => {
        NativeAdManager.inst.closeNativeAd(this.showAdData)
    }

    jieShaoClick() {
        if (this.showAdData?.data?.appDetailUrl) {
            OpenAPIManager.inst.openUrl(this.showAdData?.data?.appDetailUrl)
        }
    }

    yinSiClick() {
        if (this.showAdData?.data?.privacyUrl) {
            OpenAPIManager.inst.openUrl(this.showAdData?.data?.privacyUrl)
        }
    }

    quanXianClick() {
        if (this.showAdData?.data?.permissionUrl) {
            OpenAPIManager.inst.openUrl(this.showAdData?.data?.permissionUrl)
        }
    }
}


