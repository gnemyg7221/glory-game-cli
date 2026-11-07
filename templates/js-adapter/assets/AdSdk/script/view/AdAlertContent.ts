import { _decorator, Button, Component, Node, NodeEventType, screen, Size, UITransform, view } from "cc";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { AdUtils } from "../utils/AdUtils";
import { ButtonShowInfo, CustomAd2Manager } from "../ad/CustomAd2Manager";
import { OpenAPIManager } from "../platform/OpenAPIManager";
import { AdShowStyle, NativeAdNodeStyle } from "./NativeAdNode";
import { AdGlobal } from "../dispose/AdGlobal";

const { ccclass, property } = _decorator;

@ccclass
export default class AdAlertContent extends Component {

    public content: Node | null = null;
    public closeBtn: Node | null = null;
    public clickView: Node | null = null;
    public closeView: Node | null = null;
    public shadeNode: Node | null = null;

    private customAdMenuItem: CustomAd2Manager = new CustomAd2Manager()
    private customAdContentItem: CustomAd2Manager = new CustomAd2Manager()
    private customAdCloseItem: CustomAd2Manager = new CustomAd2Manager()

    private callBack: (success: boolean) => void = null

    private initView = () => {
        this.content = this.node.getChildByName('content')
        this.closeBtn = this.node.getChildByName('closeBtn')
        this.clickView = this.node.getChildByName('clickView')
        this.closeView = this.node.getChildByName('closeView')
        this.shadeNode = this.node.parent.getChildByName('shade')

        let btnComp = this.closeBtn.getComponent(Button);
        if (!btnComp) {
            btnComp = this.closeBtn.addComponent(Button);
        }
        
        // 允许点击
        btnComp.interactable = true;
        this.closeBtn.on(Button.EventType.CLICK, this.closeBtnClick, this);
    }

    public show = async (callBack: (success: boolean) => void) => {
        AdGlobal.canLog && console.log('AdAlertContent show!!!!!')
        this.initView()
        this.callBack = callBack
        this.content.active = false
        this.closeBtn.active = false
        this.shadeNode.active = false
        this.node.active = true

        await AdUtils.timeOut(500)

        let contentInfo = this.getNodeScreenInfo(this.content)
        this.customAdContentItem.marginTop = contentInfo.btnMT
        this.customAdCloseItem.marginTop = contentInfo.btnMT + contentInfo.btnH

        let showInfoOne = {} as ButtonShowInfo
        showInfoOne.node = this.clickView
        showInfoOne.bgColor = "#FFFFFF78"
        showInfoOne.textColor = "#50FFFFFF"

        let showInfoTwo = {} as ButtonShowInfo
        showInfoTwo.node = this.closeView
        showInfoTwo.bgColor = "#FFFFFF78"
        showInfoTwo.textColor = "#50FFFFFF"

        let menuInfo = OpenAPIManager.inst.getMenuButtonBoundingClientRect()
        let showInfoThree = {} as ButtonShowInfo
        showInfoThree.offsetX = menuInfo.left
        showInfoThree.offsetY = menuInfo.top
        showInfoThree.width = menuInfo.width
        showInfoThree.height = menuInfo.height
        showInfoThree.bgColor = "#FFFFFF78"
        showInfoThree.textColor = "#50FFFFFF"

        let adUnitIdKeyList = [AdUnitIdKey.CustomAd1, AdUnitIdKey.CustomAd2, AdUnitIdKey.CustomAd3, AdUnitIdKey.CustomAd4, AdUnitIdKey.CustomAdMenu]
        adUnitIdKeyList = AdUtils.shuffle(adUnitIdKeyList)
        AdGlobal.canLog && console.log('AdAlertContent this.customAdContentItem.show!!!')
        this.customAdContentItem.show('home', [adUnitIdKeyList[0]], AdShowStyle.AllView, NativeAdNodeStyle.Top, [showInfoOne], 1, 20, 4, (success) => {
            if (success) {
                this.resultHandle(true)
            } else {
                this.resultHandle(false)
            }
        }, () => {
            this.content.active = true
            this.shadeNode.active = true
        });

        setTimeout(() => {
            this.customAdMenuItem.show('home', [adUnitIdKeyList[1]], AdShowStyle.AllView, NativeAdNodeStyle.Top, [showInfoThree], 1, 20, 4, (success) => {
                if (success) {
                    this.resultHandle(true)
                } else {
                    this.resultHandle(false)
                }
            }, () => {
            });

            this.customAdCloseItem.show('home', [adUnitIdKeyList[2]], AdShowStyle.AllView, NativeAdNodeStyle.Top, [showInfoTwo], 1, 20, 4, (success) => {
                if (success) {
                    this.resultHandle(true)
                } else {
                    this.resultHandle(false)
                }
            }, () => {
                this.closeBtn.active = true
            });
        }, 500);
    }

    public hide = () => {
        this.node.active = false
        if (this.customAdContentItem) {
            this.customAdContentItem.clean()
        }
        if (this.customAdCloseItem) {
            this.customAdCloseItem.clean()
        }
        if (this.customAdMenuItem) {
            this.customAdMenuItem.clean()
        }
    }

    private resultHandle = (success: boolean) => {
        if (this.callBack) {
            this.callBack(success)
        }
        this.hide()
    }

    closeBtnClick = () => {
        this.resultHandle(false)
    }

    public getNodeScreenInfo = (node: Node) => {
        let btnW = 0
        let btnH = 0
        let btnMT = 0
        let btnML = 0
        let screenSizeOne = view.getVisibleSize()
        let screenSizeTwo = view.getVisibleSizeInPixel()
        let frameWidth = screen.windowSize.width / screen.devicePixelRatio
        let frameHeight = screen.windowSize.height / screen.devicePixelRatio
        let screenSizeThree = new Size(frameWidth, frameHeight)
        let scale = screenSizeTwo.width / screenSizeOne.width
        let worldPosition = node.parent.getComponent(UITransform).convertToWorldSpaceAR(node.position);
        let visibleOrigin = view.getVisibleOrigin();
        worldPosition.x = worldPosition.x + visibleOrigin.x
        worldPosition.y = worldPosition.y + visibleOrigin.y

        btnW = node.getComponent(UITransform).width * scale
        btnH = node.getComponent(UITransform).height * scale
        btnMT = screenSizeTwo.height - (worldPosition.y) * scale + (screenSizeThree.height - screenSizeTwo.height) / 2 - btnH / 2
        btnML = (worldPosition.x) * scale - btnW / 2
        return { btnMT, btnML, btnW, btnH }
    }
}