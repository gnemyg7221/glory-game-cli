import { OpenAPIManager } from "../platform/OpenAPIManager"
import { ClientMonitorType, EventType, NetWorkManager } from "../network/NetWorkManager"
import { AdUnitIdKey, ShareAppMessageRequest } from "../platform/Base/BaseOpenAPI"
import { AdUtils } from "../utils/AdUtils"


export enum ShowMoreAdType {
    NONE = 'NONE',
    LOW = 'LOW',
    MIDDLE = 'MIDDLE',
    HIGH = 'HIGH',
}


export interface AdUnitIdEcpmData {
    adId: string
    ecpm: number
    adKey: string
}

export interface AdSpaceEcpmData {
    ecpm: number
}

export class AdGlobal {

    private static _inst: AdGlobal;
    public static get inst(): AdGlobal {
        if (this._inst == null) {
            this._inst = new AdGlobal();
        }
        return this._inst;
    }

    // 开关
    public static canLog = true

    // 全局分享数据
    public static shareDate: ShareAppMessageRequest = null

    // 渠道来源
    public static options: any = null
    public static channel: string = null
    public static appKey: string = null
    public static group: string = null
    public static version: string = null
    public static clickId: string = null
    public static brand: string = null
    public static companyKey: string = null
    public static useRenderAd: string = null // 荣耀使用

    // 设备唯一标识
    public static deviceId: string = null // 自己生成
    public static androidId: string = null
    public static oaid: string = null
    public static imei: string = null

    // 其他参数
    public static forbidPrivacyDialog: boolean = false
    public static multipleAd: boolean = false
    public static platformVersionCode: number = null

    // 页面计数
    public static resultShowCount: number = 0
    public static homeShowCount: number = 0
    public static levelShowCount: number = 0
    public static gameShowCount: number = 0
    public static pageShowCount: number = 0
    public static actionCount: number = 0
    public static onShowCount: number = 0
    public static gameIsActive: boolean = true

    // 归因配置
    public static uploadAdIncome: number = 30

    // 广告配置
    public static startShowAdCount: number = 5;
    public static startShowCustomAdCount: number = 5;
    public static startAdIsShow: boolean = false
    public static restartMaxCount: number = 0
    public static restartTimeout: number = 12000
    public static adShowLoopTimeout: number = 12000
    public static adType: ShowMoreAdType = ShowMoreAdType.LOW;
    public static adUnitIdEcpmInfo: { [key: string]: AdUnitIdEcpmData } = null
    public static adSpaceTypeEcpmInfo: { [key: string]: AdSpaceEcpmData } = null
    public static useBidding: boolean = false
    public static useUpdateRestart: boolean = false

    // 轮训上报归因
    private keyAction3Upload: boolean = false;
    startQueryKeyAction = () => {
        let keyAction3UploadTimer = setInterval(async () => {
            if (this.keyAction3Upload) {
                clearInterval(keyAction3UploadTimer)
                return
            }
            let allIncome = AdUtils.adIncome
            if (window["showStartVideoEcpmNum"]) {
                allIncome = allIncome + window["showStartVideoEcpmNum"]
            }

            if ((allIncome/100) > AdGlobal.uploadAdIncome) {
                this.keyAction3Upload = true
                NetWorkManager.inst.uploadEventData('app_key_action_3', EventType.Frequency)
                let success = await NetWorkManager.inst.uploadAttributionData(ClientMonitorType.KEY)
                if (success) {
                    NetWorkManager.inst.uploadEventData('attribution_count', EventType.Frequency)
                }
            }
        }, 500)
    }

    static getAdUnitId = (adKey: AdUnitIdKey) => {
        if (!AdGlobal.adUnitIdEcpmInfo) {
            return null
        }
        let info = AdGlobal.adUnitIdEcpmInfo[adKey]
        if (!info || !info.adId) {
            return null
        }
        return info.adId + ""
    }

    static getDeviceId = () => {
        return new Promise<string>(async (resolve) => {
            OpenAPIManager.inst.getStorage("loginUserId", false, (success, data) => {
                if (success && data) {
                    resolve(data)
                    return
                }
                let deviceId = AdGlobal.getUuid()
                OpenAPIManager.inst.setStorage("loginUserId", deviceId, false, () => { });
                resolve(deviceId)
                return
            })
        })
    }

    static getUuid = () => {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            let start = Math.floor(Math.random() * 0x10)
            s[i] = hexDigits.slice(start, start + 1);
        }
        s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
        let start = (s[19] & 0x3) | 0x8
        s[19] = hexDigits.slice(start, start + 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";

        var uuid = s.join("");
        return uuid;
    }
}

