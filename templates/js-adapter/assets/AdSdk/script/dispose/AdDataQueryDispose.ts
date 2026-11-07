import { EnvUtils } from "../utils/EnvUtils"
import { AdDataQueryDisposeApk } from "./AdDataQueryDisposeApk"
import { AdDataQueryDisposeBase } from "./AdDataQueryDisposeBase"
import { AdDataQueryDisposeMini } from "./AdDataQueryDisposeMini"

export class AdDataQueryDispose {

    private static _inst: AdDataQueryDisposeBase

    public static get inst(): AdDataQueryDisposeBase {
        if (!this._inst) {
            this._inst = EnvUtils.ANDROID()
                ? new AdDataQueryDisposeApk()
                : new AdDataQueryDisposeMini()
        }
        return this._inst
    }
}
