import { Base64Utils } from '../../utils/Base64Utils'
import { JsBridgeManager } from './JsBridgeManager'

interface NativeHybridRequestData {
    type: string
    id: number
    key: string
    data: any
}

interface NativeHybridResponseData {
    type: string
    id: number
    key: string
    eventName?: string
    data: any
}

export class NativeHybridManager {

    private requestId: number = 0
    private callbackMap: { [key: string]: { [key: number]: { callback: ((success: boolean, data: any) => void), event?: ((eventName: string, data: any) => void), requestTime: number, needCheckTimeOut: boolean } } } = {}
    private eventMap: { [key: string]: { event?: ((data: any) => void) } } = {}


    public initCallbackMonitor = () => {

        JsBridgeManager.init((callType: string, data: string) => {
            if (callType !== 'hybridCall') {
                return
            }

            let responseData: NativeHybridResponseData = null
            try {
                let decodeStr = Base64Utils.strURIComponentDecode(data)
                responseData = JSON.parse(decodeStr)
            } catch (error) {
                console.error('responseData error:', error)
            }

            if (responseData && responseData.type === 'requestCallback') {
                let callbackIdMap = this.callbackMap[responseData.key]
                if (!callbackIdMap) {
                    return
                }
                let callback = callbackIdMap[responseData.id]?.callback
                callbackIdMap[responseData.id] = null
                if (callback) {
                    callback(true, responseData.data)
                }
            }

            if (responseData && responseData.type === 'eventCallback') {
                console.log('[NativeHybridManager] eventCallback:', JSON.stringify(responseData))
                let callbackIdMap = this.callbackMap[responseData.key]
                if (!callbackIdMap) {
                    return
                }
                let event = callbackIdMap[responseData.id]?.event
                console.log('[NativeHybridManager] eventCallback event:', !!event)
                if (event) {
                    event(responseData.eventName, responseData.data)
                }
            }

            if (responseData && responseData.type === 'sendEventToJs') {
                console.log('[NativeHybridManager] sendEventToJs:', JSON.stringify(responseData))
                let callInfo = this.eventMap[responseData.eventName]
                if (!callInfo) {
                    return
                }

                if (callInfo.event) {
                    callInfo.event(responseData.data)
                }
            }
        })

        setInterval(() => {
            this.checkTimeOut()
        }, 1000)
    }

    public registerEvent = (key: string, event: ((data: any) => void)) => {
        this.eventMap[key] = { event: event }
    }

    public unregisterEvent = (key: string) => {
        this.eventMap[key] = null
    }

    request = (key: string, data: any, callback: ((success: boolean, data: any) => void), event?: ((eventName: string, data: any) => void), needCheckTimeOut: boolean = true) => {

        let requestData = {} as NativeHybridRequestData
        requestData.data = data
        requestData.key = key
        requestData.type = 'request'
        requestData.id = this.getRequestId()

        let callbackIdMap = this.callbackMap[key]
        if (!callbackIdMap) {
            callbackIdMap = {}
        }

        callbackIdMap[requestData.id] = { callback: callback, event: event, requestTime: new Date().getTime(), needCheckTimeOut: needCheckTimeOut }
        this.callbackMap[key] = callbackIdMap
        let jsonStr = JSON.stringify(requestData)
        let encodeJsonStr = Base64Utils.strURIComponentEncode(jsonStr)

        JsBridgeManager.sendToNative('hybridCall', encodeJsonStr)
    }

    // 5s调用没结果就超时返回
    checkTimeOut = () => {
        for (let key in this.callbackMap) {
            let callbackIdMap = this.callbackMap[key]
            if (!callbackIdMap) {
                continue
            }
            for (let id in callbackIdMap) {
                let info = callbackIdMap[id]
                if (!info) {
                    continue
                }
                let currentTime = new Date().getTime()
                if ((currentTime - info.requestTime) > (5 * 1000) && info.needCheckTimeOut) {
                    if (info.callback) {
                        info.callback(false, null)
                    }
                    callbackIdMap[id] = null
                    console.log('checkTimeOut time out:', key, id)
                }
            }

        }
    }

    private getRequestId = () => {
        return this.requestId++
    }
}