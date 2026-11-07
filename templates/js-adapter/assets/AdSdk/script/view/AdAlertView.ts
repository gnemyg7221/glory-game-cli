import { _decorator, Component, Node } from "cc";
import { AdUtils } from "../utils/AdUtils";
import AdAlertContent from "./AdAlertContent";
import { AdGlobal } from "../dispose/AdGlobal";

const { ccclass, property } = _decorator;

@ccclass
export default class AdAlertView extends Component {
    @property(Node)
    private bgNode1: Node | null = null;

     @property(Node)
    private bgNode2: Node | null = null;

    @property({ type: AdAlertContent })
    private alertNode1: AdAlertContent | null = null;
    @property({ type: AdAlertContent })
    private alertNode2: AdAlertContent | null = null;
    @property({ type: AdAlertContent })
    private alertNode3: AdAlertContent | null = null;
    @property({ type: AdAlertContent })
    private alertNode4: AdAlertContent | null = null;
    @property({ type: AdAlertContent })
    private alertNode5: AdAlertContent | null = null;
    @property({ type: AdAlertContent })
    private alertNode6: AdAlertContent | null = null;

    private bgNodeList: Node[] = []
    private alertNodeList: AdAlertContent[] = []
    private currentAlertIndex = -1;

    protected onLoad(): void {
        this.bgNodeList = [this.bgNode1, this.bgNode2]
        this.alertNodeList = [this.alertNode1, this.alertNode2, this.alertNode3, this.alertNode4, this.alertNode5, this.alertNode6]        
    }

    public init = async () => {
        this.node.active = true
        let showSuccessCount = 0
        for (let index = 0; index < 100000; index++) {
            if (!AdGlobal.gameIsActive) {
                await AdUtils.timeOut(200)
                continue
            }
            let result = await this.show()
            if (result.success) {
                showSuccessCount++
                if (showSuccessCount >= AdGlobal.startShowAdCount) {
                    break
                }
                await AdUtils.timeOut(2000)
            }else{
                await AdUtils.timeOut(2000)
            }
        }
        this.node.active = false
    }

    private randomBg = () => {
        let randomIndex = Math.floor(Math.random() * this.bgNodeList.length)
        for (let index = 0; index < this.bgNodeList.length; index++) {
            const bgNode = this.bgNodeList[index];
            if (index === randomIndex) {
                bgNode.active = true
            } else {
                bgNode.active = false
            }
        }
    }

    private randomAlertNode = (callBack: (success: boolean) => void) => {
        
        let randomIndex = Math.floor(Math.random() * this.alertNodeList.length)
        while (randomIndex === this.currentAlertIndex) {
            randomIndex = Math.floor(Math.random() * this.alertNodeList.length)
        }
        this.currentAlertIndex = randomIndex

        for (let index = 0; index < this.alertNodeList.length; index++) {
            const alertNode = this.alertNodeList[index];
            if (index === randomIndex) {
                alertNode.show(callBack)
            } else {
                alertNode.hide()
            }
        }
    }

    private show = () => {
        return new Promise<{success: boolean}>(async (resolve) => {
            this.randomBg()
            this.randomAlertNode((success)=>{
                resolve({success})
            })
        })   
    }
}