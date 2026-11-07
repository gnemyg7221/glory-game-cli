import { OpenAPIManager } from "../platform/OpenAPIManager"
import { AdDataQueryDisposeBase } from "./AdDataQueryDisposeBase"

export class AdDataQueryDisposeApk extends AdDataQueryDisposeBase {

    public async initHomeView() {}

    public async disposeChannelData() {}

    public homeViewShow() {
        OpenAPIManager.inst.uploadPageOpenEvent("home")
    }

    public async gameViewShow() {
        OpenAPIManager.inst.uploadPageOpenEvent("game")
    }

    public async resultViewShow() {
        OpenAPIManager.inst.uploadPageOpenEvent("result")
    }

    public async pageViewShow() {
        OpenAPIManager.inst.uploadPageOpenEvent("other")
    }

    public showPrivacyAlert() {
        OpenAPIManager.inst.showPrivacyAlert(true, false)
    }
}
