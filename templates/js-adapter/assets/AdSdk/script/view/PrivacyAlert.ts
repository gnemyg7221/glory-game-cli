// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html


import { _decorator, Button, Component, Label, Node, screen, Size, UITransform, view } from "cc";
import { AdGlobal } from "../dispose/AdGlobal";
import { EnvUtils } from "../utils/EnvUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";

const { ccclass, property } = _decorator;

@ccclass('PrivacyAlert')
export default class PrivacyAlert extends Component {


    @property({ type: Node })
    public textNode: Node | null = null;
    @property({ type: Label })
    public textLabel: Label | null = null;

    @property({ type: Node })
    public linkNode: Node | null = null;

    @property({ type: Button })
    public okButton: Button | null = null;

    @property({ type: Button })
    public closeButton: Button | null = null;
    private callback: (agree: boolean) => void = null

    onLoad() {
        let width = screen.windowSize.width / view.getScaleX()
        let height = screen.windowSize.height / view.getScaleY()
        let size = new Size(width, height)
        this.node.getComponent(UITransform).setContentSize(size)
    }

    show = (callBackData: ((agree: boolean) => void), force: boolean = false) => {
        this.callback = callBackData;
        if (EnvUtils.HUAWEI()) {
            this.textNode.active = false
            this.linkNode.active = true
        } else {
            this.textNode.active = true
            this.linkNode.active = false
        }
        OpenAPIManager.inst.getStorage('PrivacyAlertShow_4', false, (success, data) => {
            if (force) {
                this.node.active = true
            } else {
                if (data === 'true') {
                    if (this.callback) {
                        this.callback(true)
                        this.callback = null
                    }
                    return
                } else {
                    this.node.active = true
                }
            }
        })
        let companyName = '天津视界创想文化传媒有限公司'
        if (AdGlobal.companyKey === 'GRJH') {
            companyName = '杭州光荣进化传媒有限公司'
        }
        let text = `发布日期：2023年5月1日
更新日期：2023年5月1日
生效日期：2023年5月1日

感谢您对本公司（即“${companyName}”
）游戏的支持，在体验游戏前，请仔细阅读我们的隐私政策条款：

一、收集个人信息

在您使用我们的游戏时，我们会收集您的个人信息，包括但不限于您的设备地址：使用信息：广告的曝光、点击、下载。

二、使用个人信息

我们收集您的个人信息是为了更好地为您提供游戏服务，改善我们的游戏体信息来验证您的身份，提供客户服务等。

三、共享个人信息

我们不会将您的个人信息出售给第三方，但有必要的情况下，为了更好地保护我们的服务安全。

四、保护个人信息

我们将采取合理的技术和管理措施来保护您的个人信息的安全性。例如，我权限，并定期对我们的安全措施进行审查和更新。

五、保留个人信息

我们将根据法律要求和业务需要保留您的个人信息。一旦我们不再需要您的

六、遵守法律和规定

我们将遵守所有适用的法律和规定，包括但不限于相关隐私法律和规定。如果您有任何隐私协议相关问题，欢迎和我们联系。

七、联系地址
公司名称：${companyName}
邮箱：evolution07@yeah.net
`

        this.textLabel.string = text

        this.okButton.node.on(Node.EventType.TOUCH_END, this.okClick, this);
        this.closeButton.node.on(Node.EventType.TOUCH_END, this.closeClick, this);

    }

    closeClick() {
        this.node.active = false
        OpenAPIManager.inst.exitApplication({})
        if (this.callback) {
            this.callback(false)
            this.callback = null
        }
    }

    okClick() {
        this.node.active = false
        OpenAPIManager.inst.setStorage('PrivacyAlertShow_4', 'true', false, () => { })
        if (this.callback) {
            this.callback(true)
            this.callback = null
        }
    }

    yinSiBtnClick() {
        if (AdGlobal.companyKey === 'GRJH') {
            OpenAPIManager.inst.openUrl('https://cdn.tjchuangxiang.cn/game/chinessPk/00001/web/adskip1/agreementgrjh.html')
        } else {
            OpenAPIManager.inst.openUrl('https://cdn.tjchuangxiang.cn/game/chinessPk/00001/web/adskip1/agreementgeneral.html')
        }
    }

}
