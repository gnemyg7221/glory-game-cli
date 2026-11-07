
import { CustomAdManager } from "../ad/CustomAdManager";
import { AdGlobal } from "../dispose/AdGlobal";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";

export enum AdSpaceType {
    Banner = 'Banner',
    Rewarded = 'Rewarded',
    GamePortal = 'GamePortal',
    Interstitial = 'Interstitial',
    NativeAd = 'NativeAd',
    CustomAd = 'CustomAd',
    StartScreen = 'StartScreen'
}

export class AdUtils {
    public static adShowTimeInfo: { [key: string]: number } = {}
    public static rewardedRestTime: number = 0
    public static rewardedCloseCount: number = 0;
    public static adShowCount = 0;
    public static adIncome = 0;

    static adShowTimeCheck = (adUnitId: string) => {
        let showTime = AdUtils.adShowTimeInfo[adUnitId]
        if (!showTime) {
            return true
        }

        let currentTime = new Date().getTime()
        if ((currentTime - showTime) < (1000 * 1)) {
            return false
        } else {
            return true
        }
    }

    static setAdShowTime = (adUnitId: string) => {
        AdUtils.adShowTimeInfo[adUnitId] = new Date().getTime()
    }

    static getDefaultEcpm = (adKey: AdUnitIdKey, adSpaceType: AdSpaceType) => {
        if (AdGlobal.adUnitIdEcpmInfo && AdGlobal.adUnitIdEcpmInfo[adKey] && AdGlobal.adUnitIdEcpmInfo[adKey].ecpm) {
            return AdGlobal.adUnitIdEcpmInfo[adKey].ecpm;
        }
        return AdUtils.getAdSpaceTypeEcpm(adSpaceType)
    }

    static getAdSpaceTypeEcpm = (adSpaceType: AdSpaceType) => {
        if (AdGlobal.adSpaceTypeEcpmInfo && AdGlobal.adSpaceTypeEcpmInfo[adSpaceType] && AdGlobal.adSpaceTypeEcpmInfo[adSpaceType].ecpm) {
            return AdGlobal.adSpaceTypeEcpmInfo[adSpaceType].ecpm;
        }
        if (adSpaceType === AdSpaceType.Banner) {
            return 50
        }
        if (adSpaceType === AdSpaceType.Interstitial) {
            return 500
        }
        if (adSpaceType === AdSpaceType.Rewarded) {
            return 1500
        }
        if (adSpaceType === AdSpaceType.NativeAd) {
            return 200
        }
        if (adSpaceType === AdSpaceType.CustomAd) {
            return 200
        }
        return 100
    }

    static timeOut = (timeout: number) => {
        return new Promise<void>(async (resolve) => {
            setTimeout(() => {
                resolve()
            }, timeout);
        })
    }


    static showTimerCustomAdList: CustomAdTimerShow[] = []

    static showTimerCustomAd = async (time?: number, style?: any) => {
        if (!time) {
            time = 25000
        }

        if (!style) {
            style = CustomAdManager.inst.topAdStyle()
        }

        let showAdItem = new CustomAdTimerShow()
        showAdItem.show(time, style)
        AdUtils.showTimerCustomAdList.push(showAdItem)
    }

    static cleanTimerCustomAd = () => {
        for (let index = 0; index < AdUtils.showTimerCustomAdList.length; index++) {
            const item = AdUtils.showTimerCustomAdList[index];
            item.close()
        }
        AdUtils.showTimerCustomAdList = []
        CustomAdManager.inst.clean()
    }

    static shuffle = (array: any[]) => {
        // 同样，先创建一个拷贝
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    public static getNeedUpdate = (restartCount: number) => {
        if (restartCount === undefined || restartCount === null) {
            restartCount = 0
        }
        let restartKey = 'restartCount' + Math.floor(Date.now() / (2 * 3600 * 1000));
        let countStr = localStorage.getItem(restartKey);
        if (!countStr) {
            countStr = "0"
        }
        let count = parseInt(countStr)
        if (count < restartCount) {
            count++
            localStorage.setItem(restartKey, count + "")
            return true
        }else{
            return false
        }
    }


    public static isRestart = false
    public static nativeApplyUpdate(timeout: number, restartCount: number, callback: ()=> void) {

        if (!this.isRestart) {
            this.isRestart = true
            this.nativeTimeOut(timeout, (success) => {
                if (success && callback && this.getNeedUpdate(restartCount)) {
                    callback()
                }
                this.isRestart = false
            })
        }
    }

    static nativeTimeOut(timeout: number, callback: (success: boolean) => void) {
        let performanceObj = qg.getPerformance()
        let currentTime = performanceObj.now()
        let checkTime = () => {
            if (AdGlobal.gameIsActive) {
                null === callback || callback(false)
                return
            }
            let runTime = performanceObj.now() - currentTime
            if (runTime >= timeout) {
                null === callback || callback(true)
            } else {
                qg.getManifestInfo({
                    success: function () {
                        null === checkTime || checkTime()
                    },
                    fail: function () {
                        null === checkTime || checkTime()
                    }
                })
            }
        }
        checkTime()
    }

    static syncSleep = (ms: number) => {
        const start = Date.now();
        while ((Date.now() - start) < ms) {
            let restartKey = 'restartCount' + Math.floor(Date.now() / (2 * 3600 * 1000));
            localStorage.getItem(restartKey);
        }
    }
    static setUpdateChannel = () => {
        let channelKey = 'updateChannel' + Math.floor(Date.now() / (2 * 3600 * 1000));
        localStorage.setItem(channelKey, AdGlobal.channel)
    }
    static getUpdateChannel = () => {
        let channelKey = 'updateChannel' + Math.floor(Date.now() / (2 * 3600 * 1000));
        let channel = localStorage.getItem(channelKey)
        if (channel) {
            localStorage.removeItem(channelKey)
        }
        return channel
    }
}

export class CustomAdTimerShow {

    private isRun = false

    show = async (time: number, style: any) => {
        if (this.isRun) {
            return
        }
        this.isRun = true
        for (let index = 0; index < 1000; index++) {
            await AdUtils.timeOut(time)
            if (!this.isRun) {
                break
            }
            await CustomAdManager.inst.asyncShow(null, style, { flicker: true })
        }
    }

    close = () => {
        this.isRun = false
    }
}