
type NativeCallback = (callType: string, data: string) => void

// Cocos Creator 版本 > 3.4
import { native } from "cc"
export class JsBridgeManager {
    private static nativeCallback: NativeCallback = null

    static init = (nativeCallback: NativeCallback) => {
        JsBridgeManager.nativeCallback = nativeCallback

        if (!native) {
            return
        }

        native.bridge.onNative = (callType: string, data: string) => {
            if ( JsBridgeManager.nativeCallback) {
                 JsBridgeManager.nativeCallback(callType, data)
            }
        }
    }

    static sendToNative = (type: string, data: any) => {
        native.bridge.sendToNative(type, data)
    }
}

// Cocos Creator 版本 < 3.4
// export class JsBridgeManager {
//     private static nativeCallback: NativeCallback = null

//     static init = (nativeCallback: NativeCallback) => {
//         JsBridgeManager.nativeCallback = nativeCallback
//         window['jsCallback'] = (callType: string, data: string) => {
//             if (JsBridgeManager.nativeCallback) {
//                 JsBridgeManager.nativeCallback(callType, data)
//             }
//         };
//     }

//     static sendToNative = (type: string, data: string) => {
//         jsb.reflection.callStaticMethod(
//             "com/cocos/game/hybrid/JsBridgeManager",
//             "sendToJava",
//             "(Ljava/lang/String;Ljava/lang/String;)V",
//             type,
//             data
//         );
//     }
// }