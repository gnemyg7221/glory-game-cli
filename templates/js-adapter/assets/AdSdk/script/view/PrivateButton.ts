import { _decorator, Component, Node } from 'cc';
import { AdDataQueryDispose } from '../dispose/AdDataQueryDispose';
import { OpenAPIManager } from '../platform/OpenAPIManager';
const { ccclass, property } = _decorator;

@ccclass('PrivateButton')
export class PrivateButton extends Component {

    public btnClickCllback:() => void = null

    start() {
        this.node.active = OpenAPIManager.inst.needPrivacyAlert()
    }

    btnClick(){
        AdDataQueryDispose.inst.showPrivacyAlert()
        if (this.btnClickCllback) {
            this.btnClickCllback()
        }
    }
}

