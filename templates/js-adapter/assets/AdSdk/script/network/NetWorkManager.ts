
import { OpenAPIManager } from '../platform/OpenAPIManager';
import { AdGlobal } from '../dispose/AdGlobal';
import { AdUtils } from '../utils/AdUtils';

export enum EventType {
    Frequency = 'frequency',// 计次每次调用+1
    Number = 'number' // 计数每次调用+N（整数客户端回传）
}

export enum ClientMonitorType {
    KEY = 'KEY',
    START = 'START'
}

// const httpUrl = 'http://localhost:9003'
const httpUrl = 'https://minigames.gegame.site'
export class NetWorkManager {
    private static _inst: NetWorkManager;
    public static get inst(): NetWorkManager {
        if (this._inst == null) {
            this._inst = new NetWorkManager();
        }
        return this._inst;
    }
    public enable = false

    getGameConfig = () => {
        return new Promise<any>(async (resolve) => {

            if (window["startGameConfig"]) {
                resolve(window["startGameConfig"])
                return
            }

            if (AdGlobal.options && AdGlobal.options.gameConfig) {
                resolve(AdGlobal.options.gameConfig)
                return
            }

            if (!AdGlobal.appKey || !AdGlobal.channel) {
                resolve(null)
                return
            }

            let requestData: any = { companyKey: AdGlobal.companyKey, appKey: AdGlobal.appKey, brand: AdGlobal.brand, channel: AdGlobal.channel, version: AdGlobal.version }
            
            if (AdGlobal.options) {
                requestData.options = JSON.stringify(AdGlobal.options)
            }

            if (AdGlobal.clickId) {
                requestData.clickId = AdGlobal.clickId
            }

            if (AdGlobal.androidId) {
                requestData.androidId = AdGlobal.androidId
            }

            if (AdGlobal.imei) {
                requestData.imei = AdGlobal.imei
            }

            if (AdGlobal.oaid) {
                requestData.oaid = AdGlobal.oaid
            }

            if (AdGlobal.deviceId) {
                requestData.deviceId = AdGlobal.deviceId
            }
            
            AdGlobal.canLog && console.log('getGameConfig requestData:', JSON.stringify(requestData))
            OpenAPIManager.inst.request({
                url: httpUrl + '/game/global/getGameConfig',
                method: 'POST',
                data: requestData,
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                success: (res) => {
                    if (res.data && res.success && res.data.success && res.data.data) {
                        AdGlobal.canLog && console.log('getGameConfig responseData', JSON.stringify(res.data.data))
                        resolve(res.data.data)
                    } else {
                        resolve(null)
                    }
                },
                fail(res) {
                    AdGlobal.canLog && console.error('getGameConfig request error:', res.data)
                    resolve(null)
                }
            })
        })
    }        

    uploadEventData = (eventKey: string, eventType: EventType, addNumber?: number, additional?:any) => {
        return new Promise(async (resolve) => {
    
            if (!AdGlobal.appKey || !eventKey || !eventType || !AdGlobal.channel) {
                resolve(null)
                return
            }
    
            let requestData: any = { companyKey: AdGlobal.companyKey, appKey: AdGlobal.appKey, channel: AdGlobal.channel, eventType: eventType, eventKey: eventKey , version: AdGlobal.version}
            
            if (addNumber) {
                requestData.addNumber = addNumber
            }

            if (additional) {
                requestData.additional = additional
            }
    
            if (AdGlobal.group) {
                requestData.group = AdGlobal.group
            }

            if (AdGlobal.brand) {
                requestData.brand = AdGlobal.brand
            }
    
            if (AdGlobal.options) {
                requestData.options = JSON.stringify(AdGlobal.options)
            }

            if (AdGlobal.clickId) {
                requestData.clickId = AdGlobal.clickId
            }

            if (AdGlobal.androidId) {
                requestData.androidId = AdGlobal.androidId
            }

            if (AdGlobal.imei) {
                requestData.imei = AdGlobal.imei
            }

            if (AdGlobal.oaid) {
                requestData.oaid = AdGlobal.oaid
            }

            if (AdGlobal.deviceId) {
                requestData.deviceId = AdGlobal.deviceId
            }

            OpenAPIManager.inst.request({
                url: httpUrl + '/data/report/uploadData',
                method: 'POST',
                data: requestData,
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                success: (res) => {
                    if (res.data && res.data.success && res.data.data) {                        
                        resolve(res.data.data)
                    } else {
                        resolve(null)
                    }
                },
                fail(res) {
                    AdGlobal.canLog && console.error('uploadEventData request error:', res.data)
                    resolve(null)
                }
            })
        })
    }
    
    uploadErrorMsg = (errorCode: string, errorMsg: string) => {

        return new Promise(async (resolve) => {

            if (!AdGlobal.appKey || !AdGlobal.channel) {
                resolve(null)
                return
            }
    
            let requestData: any = { companyKey: AdGlobal.companyKey, appKey: AdGlobal.appKey, channel: AdGlobal.channel, errorCode: errorCode, errorMsg: errorMsg, version:AdGlobal.version}
    
            if (AdGlobal.group) {
                requestData.group = AdGlobal.group
            }

            if (AdGlobal.brand) {
                requestData.brand = AdGlobal.brand
            }
    
            if (AdGlobal.options) {
                requestData.options = JSON.stringify(AdGlobal.options)
            }

            if (AdGlobal.clickId) {
                requestData.clickId = AdGlobal.clickId
            }

            if (AdGlobal.androidId) {
                requestData.androidId = AdGlobal.androidId
            }

            if (AdGlobal.imei) {
                requestData.imei = AdGlobal.imei
            }

            if (AdGlobal.oaid) {
                requestData.oaid = AdGlobal.oaid
            }

            if (AdGlobal.deviceId) {
                requestData.deviceId = AdGlobal.deviceId
            }

            OpenAPIManager.inst.request({
                url: httpUrl + '/data/report/uploadErrorMsg',
                method: 'POST',
                data: requestData,
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                success: (res) => {
                    if (res.data && res.data.success && res.data.data) {                        
                        resolve(res.data.data)
                    } else {
                        resolve(null)
                    }
                },
                fail(res) {
                    AdGlobal.canLog && console.error('uploadErrorMsg request error:', res.data)
                    resolve(null)
                }
            })
        })
    }

    uploadAttributionData = (type: ClientMonitorType) => {
        
        return new Promise(async (resolve) => {

            if (window["showStartVideoWillShow"]) {
                resolve(false)
                return
            }
            
            if (!AdGlobal.appKey || !AdGlobal.channel) {
                resolve(false)
                return
            }

            let requestData: any = { type: type, companyKey: AdGlobal.companyKey, appKey: AdGlobal.appKey, channel: AdGlobal.channel, version:AdGlobal.version, adIncome: AdUtils.adIncome, adShowCount: AdUtils.adShowCount}
            if (AdGlobal.options) {
                requestData.options = JSON.stringify(AdGlobal.options)
            }

            if (AdGlobal.clickId) {
                requestData.clickId = AdGlobal.clickId
            }

            if (AdGlobal.androidId) {
                requestData.androidId = AdGlobal.androidId
            }

            if (AdGlobal.imei) {
                requestData.imei = AdGlobal.imei
            }

            if (AdGlobal.oaid) {
                requestData.oaid = AdGlobal.oaid
            }

            if (AdGlobal.deviceId) {
                requestData.deviceId = AdGlobal.deviceId
            }

            
            AdGlobal.canLog && console.log('uploadAttributionData requestData:', JSON.stringify(requestData))
            OpenAPIManager.inst.request({
                url: httpUrl + '/data/da/client',
                method: 'POST',
                data: requestData,
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                success: (res) => {
                    AdGlobal.canLog && console.log('uploadAttributionData responseData:', JSON.stringify(res))                        
                    if (res.data && res.data.success && res.data.data) {
                        resolve(true)
                    } else {
                        resolve(false)
                    }
                },
                fail(res) {
                    AdGlobal.canLog && console.error('uploadAttributionData request error:', res.data)
                    resolve(false)
                }
            })
        })
    }

    uploadComplaint = (complaintData: any) => {
        AdGlobal.canLog && console.log('uploadComplaint:', complaintData)

        return new Promise(async (resolve) => {

            if (!AdGlobal.appKey || !AdGlobal.channel) {
                resolve(false)
                return
            }
    
            let requestData: any = { companyKey: AdGlobal.companyKey, appKey: AdGlobal.appKey, channel: AdGlobal.channel, complaintData: JSON.stringify(complaintData), version:AdGlobal.version}
    
            if (AdGlobal.group) {
                requestData.group = AdGlobal.group
            }

            if (AdGlobal.brand) {
                requestData.brand = AdGlobal.brand
            }
    
            if (AdGlobal.options) {
                requestData.options = JSON.stringify(AdGlobal.options)
            }

            if (AdGlobal.clickId) {
                requestData.clickId = AdGlobal.clickId
            }

            if (AdGlobal.androidId) {
                requestData.androidId = AdGlobal.androidId
            }

            if (AdGlobal.imei) {
                requestData.imei = AdGlobal.imei
            }

            if (AdGlobal.oaid) {
                requestData.oaid = AdGlobal.oaid
            }

            if (AdGlobal.deviceId) {
                requestData.deviceId = AdGlobal.deviceId
            }

            OpenAPIManager.inst.request({
                url: httpUrl + '/data/report/uploadComplaint',
                method: 'POST',
                data: requestData,
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                success: (res) => {
                    if (res.data && res.data.success && res.data.data) {                        
                        resolve(true)
                    } else {
                        resolve(false)
                    }
                },
                fail(res) {
                    AdGlobal.canLog && console.error('uploadComplaint request error:', res.data)
                    resolve(false)
                }
            })
        })
    }
}
