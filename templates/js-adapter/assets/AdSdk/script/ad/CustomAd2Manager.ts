import { Node, screen, Size, UITransform, view } from "cc";
import { EventType, NetWorkManager } from "../network/NetWorkManager";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { AdSpaceType, AdUtils } from '../utils/AdUtils';
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";
import { AdGlobal } from "../dispose/AdGlobal";

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

export enum CustomeContentType {
    Link = 1,
    DOWNLOAD = 2
}

export interface CustomAd2Data {
    adId: string
    title: string
    desc: string
    logoUrl: string
    iconUrl: string
    imgUrlList: string[]
    clickBtnTxt: string
    creativeType: number
    contentType: CustomeContentType
}

export enum ButtonShowState {
    SINGLE = 'SINGLE',  // 一个坑位只展示一次广告
    MUTABLE = 'MUTABLE' // 一个坑位可以展示多次广告
}

export interface ButtonShowInfo {
    node: Node
    showAdData: ShowAdData
    showState: ButtonShowState
    forbid: boolean
    offsetX?: number
    offsetY?: number
    width?: number
    height?: number
    bgColor?: string
    textColor?: string
}

export interface ShowAdData {
    nativeAd: any
    adKey: string
    subKey: AdUnitIdKey
    data: CustomAd2Data
    appState?: AppState
    ecpm: number
}

const SHOW_LOG = false

export class CustomAd2Manager {

    private static _inst: CustomAd2Manager;
    public static get inst(): CustomAd2Manager {
        if (this._inst == null) {
            this._inst = new CustomAd2Manager();
        }
        return this._inst;
    }

    private downloadAppName: string[] = []
    private willShowAdList: ShowAdData[] = []
    private willDestroyList: ShowAdData[] = []
    private inQueryKeyList: AdUnitIdKey[] = []

    private showInfoList: ButtonShowInfo[] = null
    private nativeAdNodeStyle: NativeAdNodeStyle = null
    private adShowStyle: AdShowStyle = null

    private clickCount = 0
    private clickCountMax = 10

    private downloadQueryCountMax = 5
    private refreshCountMax = 20
    private refreshCount = 0

    private isRun = false
    private dataIsQuery = false
    private queryTimer = null

    private adIsDownload = false
    private adIsSkip = false

    // 外部属性设置
    public adLogoStyle: string = 'right'
    public marginTop: number = 0

    private callback: (success: boolean) => void
    private showCallback: () => void

    private static downloadAdtitleList: string[] = []

    nativeAdIsShow = () => {
        return this.showInfoList.filter(info => !!info.showAdData).length > 0
    }

    nativeAdIsSkip = () => {
        return this.adIsSkip
    }

    nativeAdIsDownload = () => {
        return this.adIsDownload
    }

    nativeAdIsClick = () => {
        return (this.adIsSkip || this.adIsDownload)
    }

    public show = async (adKey: string, subKeyList: AdUnitIdKey[], adShowStyle: AdShowStyle, nativeAdNodeStyle: NativeAdNodeStyle, showInfoList: ButtonShowInfo[], clickCountMax: number, refreshCountMax: number, downloadQueryCountMax: number, callback: (success: boolean) => void, showCallback?: () => void) => {
        SHOW_LOG && console.log('[CustomAd2Manager] show', adKey, subKeyList)
        this.callback = callback
        this.showCallback = showCallback
        this.clickCountMax = clickCountMax
        this.refreshCountMax = refreshCountMax
        this.downloadQueryCountMax = downloadQueryCountMax

        this.showInfoList = showInfoList
        this.nativeAdNodeStyle = nativeAdNodeStyle
        this.adShowStyle = adShowStyle

        if (!adKey || !subKeyList.length) {
            NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.NativeAd, EventType.Frequency)
            NetWorkManager.inst.uploadErrorMsg('-1', 'radUsable is false' + `[类型: 自渲染 brand: ${AdGlobal.brand} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
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
            this.checkShowAdView(this.showInfoList, nativeAdNodeStyle)
        } else {
            SHOW_LOG && console.log('[CustomAd2Manager] 开始一轮广告并行请求')
            let success = await this.refreshAdDataParallel(adKey, subKeyList, adShowStyle)
            if (success) {
                this.checkShowAdView(this.showInfoList, nativeAdNodeStyle)
            }
        }

        // 请求广告数据
        this.queryTimer = setInterval(async () => {
            if (!this.isRun) {
                return
            }

            if (this.dataIsQuery) {
                return
            }
            this.dataIsQuery = true

            SHOW_LOG && console.log('[CustomAd2Manager] 开始一轮广告串行请求', this.clickCount, this.clickCountMax, '|', this.refreshCount, this.refreshCountMax, '|', this.showInfoList.filter(info => !!info.showAdData).length === 0, this.willShowAdList.length === 0, '|', this.dataIsQuery)
            if (this.clickCount >= this.clickCountMax || this.refreshCount >= this.refreshCountMax) {
                if (this.showInfoList.filter(info => !!info.showAdData).length === 0 && this.willShowAdList.length === 0) {
                    this.closeNativeAd(null)
                }
                return
            }

            if (this.adShowStyle === AdShowStyle.OnlyBtn || this.adShowStyle === AdShowStyle.DownloadView) {
                if (this.refreshCount > this.downloadQueryCountMax) {
                    this.adShowStyle = AdShowStyle.AllView
                    SHOW_LOG && console.log('[CustomAd2Manager] adShowStyle change AdShowStyle.AllView')
                }
            }

            await this.refreshAdDataSerial(adKey, subKeyList, this.adShowStyle, false, async () => {
                let showViewSuccess = await this.checkShowAdView(this.showInfoList, nativeAdNodeStyle)
                SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView:', showViewSuccess)
            })
            this.dataIsQuery = false
        }, 500)
    }

    public preloadAdData = async (adKey: string, subKeyList: AdUnitIdKey[], adShowStyle: AdShowStyle) => {
        SHOW_LOG && console.log('[CustomAd2Manager] preloadAdData:', adKey, subKeyList)
        let success = await this.refreshAdDataSerial(adKey, subKeyList, adShowStyle, true)
        if (success) {
            SHOW_LOG && console.log('[CustomAd2Manager] preloadAdData:', success)
        }
    }

    public clean = () => {
        if (this.queryTimer) {
            clearInterval(this.queryTimer)
        }

        this.clickCount = 0
        this.refreshCount = 0
        this.dataIsQuery = false

        this.callback = null
        this.showCallback = null

        if (this.showInfoList) {
            this.showInfoList.forEach((showAd) => {
                if (showAd.showAdData) {
                    this.closeNativeAd(showAd)
                }
            })
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
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataParallel 以准备好，跳过：', subKey, willShowAdData?.data?.title)
                    return
                }

                let willDestroyAdData = this.subKeyWillDestroy(subKey)
                if (willDestroyAdData) {
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataParallel 准备释放，跳过：', subKey, willDestroyAdData.data?.title)
                    return
                }

                if (this.subKeyInQuery(subKey)) {
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataParallel 已加载中，跳过：', subKey)
                    return
                }

                queryTaskList.push(this.queryNativeAdData(adKey, subKey, index * 100))
                this.inQueryKeyList.push(subKey)

            })

            let nativeDataInfoList = await Promise.all(queryTaskList)
            SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataParallel showAdDataList count:', nativeDataInfoList.length)
            for (let index = 0; index < nativeDataInfoList.length; index++) {
                const showAdData = nativeDataInfoList[index];
                this.inQueryKeyList = this.inQueryKeyList.filter(key => key !== showAdData.subKey);
                if (!showAdData.data) {
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataParallel showAdData is Null!', JSON.stringify(showAdData))
                    if (showAdData.nativeAd) {
                        this.willDestroyList.push(showAdData)
                    }
                    this.refreshCount++
                    continue
                }

                let queryIsNull = true
                let type = this.checkAdDataType(showAdData)
                if (adShowStyle === AdShowStyle.AllView) {
                    if (type === AppState.DOWNLOAD || type === AppState.INSTALLED) {
                        this.downloadAppName.push(showAdData.data.title)
                        this.willShowAdList.push(showAdData)
                        queryIsNull = false
                    }   else {
                        this.willDestroyList.push(showAdData)
                    }
                } else if (adShowStyle === AdShowStyle.DownloadView || adShowStyle === AdShowStyle.OnlyBtn) {
                    if (type === AppState.DOWNLOAD) {
                        this.willShowAdList.push(showAdData)
                        this.downloadAppName.push(showAdData.data.title)
                        queryIsNull = false
                    } else {
                        this.willDestroyList.push(showAdData)
                    }
                }
                if (queryIsNull) {
                    this.refreshCount++
                }

            }
            resolve(true)
            // 广告销毁
            setTimeout(() => {
                for (let index = 0; index < this.willDestroyList.length; index++) {
                    const adData = this.willDestroyList[index];
                    if (adData.nativeAd.notifyAdRankLoss && adData?.data?.adId) {
                        adData.nativeAd.notifyAdRankLoss({ adId: adData.data.adId, winPrice: 0, code: 1, channel: "mob" });
                    }
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
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataSerial 以准备好，跳过：', subKey, willShowAdData?.data?.title)
                    continue
                }

                let willDestroyAdData = this.subKeyWillDestroy(subKey)
                if (willDestroyAdData) {
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataSerial 准备释放，跳过：', subKey, willDestroyAdData.data?.title)
                    continue
                }

                if (this.subKeyInQuery(subKey)) {
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataSerial 已加载中，跳过：', subKey)
                    continue
                }

                this.inQueryKeyList.push(subKey)
                let showAdData = await this.queryNativeAdData(adKey, subKey)
                this.inQueryKeyList = this.inQueryKeyList.filter(key => key !== subKey);

                if (!showAdData || !showAdData.data) {
                    SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataSerial is Null！:', subKey)
                    if (showAdData.nativeAd) {
                        this.willDestroyList.push(showAdData)
                    }
                    this.refreshCount++
                    continue
                }
                SHOW_LOG && console.log('[CustomAd2Manager] refreshAdDataSerial showAdData:', showAdData?.data.title)
                let queryIsNull = true
                let type = this.checkAdDataType(showAdData)
                if (adShowStyle === AdShowStyle.AllView) {
                    if (type === AppState.DOWNLOAD) {
                        this.downloadAppName.push(showAdData.data.title)
                    }
                    this.willShowAdList.push(showAdData)
                    addAdCallback && addAdCallback()
                    queryIsNull = false
                } else if (adShowStyle === AdShowStyle.DownloadView || adShowStyle === AdShowStyle.OnlyBtn) {
                    if (type === AppState.DOWNLOAD) {
                        this.willShowAdList.push(showAdData)
                        this.downloadAppName.push(showAdData.data.title)
                        addAdCallback && addAdCallback()
                        queryIsNull = false
                    } else {
                        this.willDestroyList.push(showAdData)
                    }
                }

                if (queryIsNull && !preload) {
                    this.refreshCount++
                }
            }

            // 广告销毁
            for (let index = 0; index < this.willDestroyList.length; index++) {
                const adData = this.willDestroyList[index];
                if (adData.nativeAd.notifyAdRankLoss && adData?.data?.adId) {
                    adData.nativeAd.notifyAdRankLoss({ adId: adData.data.adId, winPrice: 0, code: 1, channel: "mob" });
                }
                this.destroyAd(adData)
            }
            this.willDestroyList = []
            resolve(true)
        })
    }

    private subKeyWillShow = (subKey: string) => {

        for (let index = 0; index < this.showInfoList.length; index++) {
            const showInfo = this.showInfoList[index];
            if (showInfo.showAdData && showInfo.showAdData.subKey === subKey) {
                return showInfo.showAdData
            }
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

    private checkShowAdView = async (showInfoList: ButtonShowInfo[], nodeStyle: NativeAdNodeStyle) => {

        if (!this.isRun) {
            return false
        }

        let adLogInfo = 'current:'
        showInfoList.forEach((data) => {
            if (data.showAdData) {
                adLogInfo = adLogInfo + data.showAdData.subKey + '-' + data.showAdData?.data.title
            }
        })
        adLogInfo = adLogInfo + ',willShow:'
        this.willShowAdList.forEach((data) => {
            adLogInfo = adLogInfo + data.subKey + '-' + data.data.title + ','
        })

        SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView 开始处理View相关逻辑:', adLogInfo)

        let nullInfoList = showInfoList.filter((info) => {
            return !info.showAdData && !info.forbid
        })

        if (nullInfoList.length === 0) {
            SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView 当前有正在展示的广告已满', showInfoList.forEach((data) => { return data.showAdData?.data?.title }))
            return false
        }

        for (let index = 0; index < nullInfoList.length; index++) {
            if (this.willShowAdList.length === 0) {
                SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView 当前没有可展示广告')
                break
            }
            const nullInfo = nullInfoList[index];

            let showAdData: ShowAdData = null
            showAdData = this.willShowAdList.pop()
            nullInfo.showAdData = showAdData
            let needShowDetail = true
            if (this.adShowStyle === AdShowStyle.OnlyBtn) {
                needShowDetail = false
            }

            SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView 展示View中', showAdData.subKey, showAdData.data?.title)
            let success = await this.showDetailView(nullInfo, nodeStyle, needShowDetail)
            SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView 展示View完成', success, showAdData.data)
            if (!success) {
                this.downloadAppName = this.downloadAppName.filter(name => name !== showAdData.data.title)
                this.closeNativeAd(nullInfo)
                return false
            } else {
                // 如果是单次模式，展示过一次就不能再展示了。
                if (nullInfo.showState === ButtonShowState.SINGLE) {
                    nullInfo.forbid = true
                }
            }

            showAdData.appState = AppState.INSTALLED
            SHOW_LOG && console.log('[CustomAd2Manager] checkShowAdView 结束处理View相关逻辑')
        }
        return true
    }

    private checkAdDataType = (showAdData: ShowAdData) => {

        if (CustomAd2Manager.downloadAdtitleList.indexOf(showAdData.data.title) !== -1) {
            SHOW_LOG && console.log('[CustomAd2Manager] checkAdDataType 下载中App:', showAdData.data.title, showAdData.subKey, showAdData.data.clickBtnTxt, showAdData.data.creativeType, showAdData.data.contentType)
            return AppState.WAITING
        }

        if (this.downloadAppName.indexOf(showAdData.data.title) !== -1) {
            SHOW_LOG && console.log('[CustomAd2Manager] checkAdDataType 重复App:', showAdData.data.title, showAdData.subKey, showAdData.data.clickBtnTxt, showAdData.data.creativeType, showAdData.data.contentType)
            return AppState.INSTALLED
        }

        if (showAdData.data.contentType === CustomeContentType.DOWNLOAD) {
            SHOW_LOG && console.log('[CustomAd2Manager] checkAdDataType 可下载App:', showAdData.data.title, showAdData.subKey, showAdData.data.clickBtnTxt, showAdData.data.creativeType, showAdData.data.contentType)
            return AppState.DOWNLOAD
        } else {
            SHOW_LOG && console.log('[CustomAd2Manager] checkAdDataType 可打开App:', showAdData.data.title, showAdData.subKey, showAdData.data.clickBtnTxt, showAdData.data.creativeType, showAdData.data.contentType)
            return AppState.INSTALLED
        }
    }

    private reportAdShow = async (showAdData: ShowAdData) => {
        if (showAdData.nativeAd && showAdData?.data?.adId) {
            SHOW_LOG && console.log('[CustomAd2Manager] 广告曝光:', showAdData?.data?.title)

            let ecpm = await this.getAdEcpm(showAdData)
            if (ecpm > 0) {
                showAdData.ecpm = ecpm
            }

            AdUtils.adShowCount++
            AdUtils.adIncome = AdUtils.adIncome + showAdData.ecpm
            NetWorkManager.inst.uploadEventData('ad_show_' + AdSpaceType.NativeAd, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_incom_' + AdSpaceType.NativeAd, EventType.Number, showAdData.ecpm)
            if (showAdData.data.contentType === CustomeContentType.DOWNLOAD) {
                NetWorkManager.inst.uploadEventData('ad_download_show_' + AdSpaceType.NativeAd, EventType.Frequency)
            } else {
                NetWorkManager.inst.uploadEventData('ad_skip_show_' + AdSpaceType.NativeAd, EventType.Frequency)
            }

            if (this.showCallback) {
                this.showCallback()
            }
        }
    }

    private getAdEcpm = (showAdData: ShowAdData) => {
        return new Promise<number>(async (resolve) => {
            if (!showAdData.nativeAd.getAdECPM) {
                resolve(-1)
                return
            }

            let onGetAdECPMCallback = (data: any) => {
                SHOW_LOG && console.log('[CustomAd2Manager] onGetAdECPMCallback data:', data)
                if (data && data.ECPM && data.ECPM.ECPM && data.ECPM.ECPM.ECPMCode === 0 && data.ECPM.ECPM.ECPMPrice > 0) {
                    let becpm = data.ECPM.ECPM.ECPMPrice
                    becpm = Math.round(becpm)
                    if (becpm < 1) {
                        becpm = 1
                    }

                    SHOW_LOG && console.log('[CustomAd2Manager] onGetAdECPMCallback becpm:', becpm)
                    showAdData.nativeAd.notifyAdRankWin({ lossPrice: 0, adId: showAdData.data.adId });
                    resolve(becpm)
                } else {
                    resolve(-1)
                }
            };
            //注册价格请求回调
            showAdData.nativeAd.onGetAdECPM(onGetAdECPMCallback);
            showAdData.nativeAd.getAdECPM({ adId: showAdData.data.adId })
        })
    }

    private queryButtonShowInfo = (showAdData: ShowAdData) => {
        if (!showAdData) {
            return null
        }

        for (let index = 0; index < this.showInfoList.length; index++) {
            const element = this.showInfoList[index];
            if (element.showAdData === showAdData) {
                return element
            }
        }

        return null
    }

    public closeNativeAd = (buttonShowInfo: ButtonShowInfo, needDestroy: boolean = true) => {
        let showAdData = buttonShowInfo?.showAdData
        if (needDestroy && showAdData) {
            this.destroyAd(showAdData)
        }

        if (buttonShowInfo?.showAdData) {
            buttonShowInfo.showAdData = null
        }

        if (this.clickCount >= this.clickCountMax) {
            SHOW_LOG && console.log('[CustomAd2Manager] closeNativeAd 自渲染广告关闭 任务成功', showAdData?.data.title)
            this.callback && this.callback(true)
            setTimeout(() => {
                this.clean()
            }, 500);
            return
        }

        if (this.refreshCount >= this.refreshCountMax && this.showInfoList.filter(info => !!info.showAdData).length === 0 && this.willShowAdList.length === 0) {
            SHOW_LOG && console.log('[CustomAd2Manager] closeNativeAd 自渲染广告关闭 任务失败', showAdData?.data.title)
            this.callback && this.callback(false)
            this.clean()
            return
        }
        SHOW_LOG && console.log('[CustomAd2Manager] closeNativeAd 自渲染广告关闭 执行中', showAdData?.data.title)

        setTimeout(() => {
            this.checkShowAdView(this.showInfoList, this.nativeAdNodeStyle)
        }, 100);
    }

    private destroyAd = (showAdData: ShowAdData) => {
        if (showAdData.nativeAd) {
            SHOW_LOG && console.log('[CustomAd2Manager] 广告销毁:', showAdData.subKey, showAdData?.data?.title)
            showAdData.nativeAd.destroy()
        }
    }

    private queryNativeAdData = (adKey: string, subkey: AdUnitIdKey, timeout: number = 0) => {
        return new Promise<ShowAdData>(async (resolve) => {

            if (timeout) {
                await AdUtils.timeOut(timeout)
            }

            NetWorkManager.inst.uploadEventData('ad_download_request_' + AdSpaceType.NativeAd, EventType.Frequency)
            NetWorkManager.inst.uploadEventData('ad_request_' + AdSpaceType.NativeAd, EventType.Frequency)

            let showAdData = {} as ShowAdData
            showAdData.subKey = subkey
            showAdData.adKey = adKey
            showAdData.ecpm = AdUtils.getDefaultEcpm(subkey, AdSpaceType.NativeAd)

            if (!adKey || !subkey) {
                NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg('-3', 'adKey is null' + `[类型: 自渲染 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                resolve(showAdData)
                return
            }

            let adId = OpenAPIManager.inst.getAdUnitId(subkey);

            if (!adId) {
                NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg('-3', 'nativeAd id is null' + `[类型: 自渲染 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                resolve(showAdData)
                return
            }

            let size = OpenAPIManager.inst.getScreenSize()
            if (!size) {
                return null
            }
            let width = size.width
            let height = size.height

            let style = {
                top: this.marginTop,
                left: 0,
                width: width,
                height: height,
                gravity: "top|center_horizontal"
            }
            let nativeAd = OpenAPIManager.inst.createNativeAd(adId, style)

            if (!nativeAd) {
                NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg('-3', 'nativeAd error' + `[类型: 自渲染 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)
                resolve(showAdData)
                return
            }

            let loadCompleted = false
            let onError = (res: any) => {
                AdGlobal.canLog && console.error('[CustomAd2Manager]:自渲染 广告显示error', adId, JSON.stringify(res))
                let errMsg = res.msg
                let errCode = res.code

                NetWorkManager.inst.uploadEventData('ad_load_error_' + AdSpaceType.NativeAd, EventType.Frequency)
                NetWorkManager.inst.uploadErrorMsg(errCode, errMsg + `[类型: 自渲染 brand: ${AdGlobal.brand} subKey: ${subkey} version: ${AdGlobal.version} uid: ${AdGlobal.androidId} count: ${AdUtils.adShowCount}]`)

                if (!loadCompleted) {
                    loadCompleted = true
                    showAdData.nativeAd = nativeAd
                    resolve(showAdData)
                }
            }

            let onClick = (res) => {
                SHOW_LOG && console.log(`[CustomAd2Manager] 自渲染广告2.0 onClick, code: ${res.code}, msg: ${res.msg}`);
                if (showAdData.data.contentType === CustomeContentType.DOWNLOAD) {
                    NetWorkManager.inst.uploadEventData('ad_download_' + AdSpaceType.NativeAd, EventType.Frequency)
                    this.adIsDownload = true
                    setTimeout(() => {
                        this.adIsDownload = false
                    }, 2000);
                    if (showAdData.data.title) {
                        CustomAd2Manager.downloadAdtitleList.push(showAdData.data.title)
                    }
                } else {
                    NetWorkManager.inst.uploadEventData('ad_skip_' + AdSpaceType.NativeAd, EventType.Frequency)
                    this.adIsSkip = true
                    setTimeout(() => {
                        this.adIsSkip = false
                    }, 2000);
                }
                this.clickCount++
                this.closeNativeAd(this.queryButtonShowInfo(showAdData))
            };

            let onClose = (res) => {
                SHOW_LOG && console.log(`[CustomAd2Manager] 自渲染广告2.0 onClose, code: ${res.code}, msg: ${res.msg}`);
                this.closeNativeAd(this.queryButtonShowInfo(showAdData))
            }

            let onLoad = async (data: { adList: CustomAd2Data[], code: number, msg: number }) => {
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
                    showAdData.data = this.disposeNativeData(data.adList[0])
                    resolve(showAdData)
                }
            }

            setTimeout(() => {
                if (!loadCompleted) {
                    loadCompleted = true
                    console.info('[CustomAd2Manager] setTimeout')
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

            if (nativeAd?.onClose) {
                nativeAd?.onClose(onClose)
            }

            if (nativeAd?.onClick) {
                nativeAd?.onClick(onClick)
            }

            nativeAd.load()
        })
    }

    private disposeNativeData = (data: any) => {
        let customData = {} as CustomAd2Data
        if (EnvUtils.OPPO()) {
            customData.adId = data.adId
            customData.clickBtnTxt = data.clickBtnTxt
            customData.creativeType = data.creativeType
            customData.desc = data.des
            customData.iconUrl = data.iconUrl
            customData.imgUrlList = data.imgUrlList
            customData.logoUrl = data.logoUrl
            customData.title = data.title
            if (data.contentType === 2) {
                customData.contentType = CustomeContentType.DOWNLOAD;
            } else {
                customData.contentType = CustomeContentType.Link;
            }
        }

        if (EnvUtils.RONGYAO()) {
            customData.adId = data.adId
            customData.title = data.title
            customData.logoUrl = data.logoUrl
            customData.imgUrlList = data.imgUrlList
            customData.creativeType = data.subType
            if (data.promotionPurpose === 0) {
                customData.contentType = CustomeContentType.DOWNLOAD;
            } else {
                customData.contentType = CustomeContentType.Link;
            }
        }


        return customData
    }

    private showDetailView = async (showInfo: ButtonShowInfo, style: NativeAdNodeStyle, needShowDetail: boolean) => {
        return new Promise<boolean>(async (resolve) => {
            let data = showInfo.showAdData
            if (!data?.data?.adId || !data.nativeAd) {
                resolve(false)
                return
            }

            let size = OpenAPIManager.inst.getScreenSize()
            let btnMT = 0
            let btnML = 0
            let btnW = 0
            let btnH = 0
            let color = '#000000'
            let textColor = '#000000'
            if (showInfo.node) {
                let screenSizeOne = view.getVisibleSize()
                let screenSizeTwo = view.getVisibleSizeInPixel()
                let frameWidth = screen.windowSize.width / screen.devicePixelRatio
                let frameHeight = screen.windowSize.height / screen.devicePixelRatio
                let screenSizeThree =  new Size(frameWidth, frameHeight)
                let scale = screenSizeTwo.width / screenSizeOne.width
                let worldPosition = showInfo.node.parent.getComponent(UITransform).convertToWorldSpaceAR(showInfo.node.position);
                let visibleOrigin = view.getVisibleOrigin();
                worldPosition.x = worldPosition.x + visibleOrigin.x
                worldPosition.y = worldPosition.y + visibleOrigin.y

                btnW = showInfo.node.getComponent(UITransform).width * scale
                btnH = showInfo.node.getComponent(UITransform).height * scale

                if (showInfo.height) {
                    btnH = showInfo.height * scale
                }

                if (showInfo.width) {
                    btnW = showInfo.width * scale
                }

                if (!btnH) {
                    btnH = 96
                }

                if (!btnW) {
                    btnW = 222
                }

                btnMT = screenSizeTwo.height - (worldPosition.y) * scale + (screenSizeThree.height - screenSizeTwo.height) / 2 - btnH / 2
                btnML = (worldPosition.x) * scale - btnW / 2
            } else {
                btnW = showInfo.width || 222
                btnH = showInfo.height || 96
            }

            if (showInfo.offsetX !== undefined && showInfo.offsetX !== null) {
                btnML = btnML + showInfo.offsetX
            }

            if (showInfo.offsetY !== undefined && showInfo.offsetY !== null) {
                btnMT = btnMT + showInfo.offsetY
            }

            if (btnMT < 0) {
                btnMT = 0
            }

            if (btnML < 0) {
                btnML = 0
            }

            if (showInfo.bgColor) {
                color = showInfo.bgColor
            }

            if (showInfo.textColor) {
                textColor = showInfo.textColor
            }
            btnMT = btnMT - this.marginTop
            AdGlobal.canLog && console.log('createComponent AdButton', data.data.adId, btnMT, btnML, btnH, btnW, color)
            data.nativeAd.createComponent({
                adId: data.data.adId,
                componentType: "AdButton",
                style: {
                    top: Math.round(btnMT),
                    left: Math.round(btnML),
                    height: Math.round(btnH),
                    width: Math.round(btnW),
                    opacity: 0.3,
                    fontSize: 10,
                    color: color,
                    textColor: textColor
                }
            })
            if (data.data.contentType === CustomeContentType.DOWNLOAD) {
                data.nativeAd.createComponent({
                    adId: data.data.adId,
                    componentType: "AdPrivacy",
                    style: {
                        privacyStyle: "dark",
                        fontSize: 2
                    }
                })
            }

            data.nativeAd.createComponent({
                adId: data.data.adId,
                componentType: "AdCloseButton",
                style: {
                    closeStyle: "topLeft",
                    top: 0,
                    left: 0
                }
            })

            let adLogoLeft = size.width - 100
            if (this.adLogoStyle === 'left') {
                adLogoLeft = 0
            }

            data.nativeAd.createComponent({
                adId: data.data.adId,
                componentType: "AdLogo",
                style: {
                    top: 0,
                    left: 0
                }
            })

            data.nativeAd.show({
                adId: data.data.adId,
            }).then(() => {
                this.reportAdShow(data)
                resolve(true)
            }).catch((err) => {
                AdGlobal.canLog && console.error(`[CustomAd2Manager] nativeAd.show 回调：展示失败 ${JSON.stringify(err)}`);
                resolve(false)
            });
        })
    }
}



