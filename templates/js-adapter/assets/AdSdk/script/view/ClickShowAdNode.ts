import { _decorator, AudioSource, Component, Input, Label, Node, screen, Size, size, Sprite, tween, UITransform, Vec3, view, Widget } from "cc";
import { EnvUtils } from "../utils/EnvUtils";
import { BannerAdManager } from "../ad/BannerAdManager";
import { RewardedVideoAdManager } from "../ad/RewardedVideoAdManager";
import { NativeAdManager } from "./NativeAdNode";

const { ccclass, property } = _decorator;

export enum ClickShowAdNodeType {
    Home = 'Home',
    Game = 'Game'
}

@ccclass
export class ClickShowAdNode extends Component {
    @property({ type: Sprite })
    public waterSprite: Sprite | null = null;

    @property({ type: Node })
    public closeButtonNode: Node | null = null;  
    
    @property({ type: Label })
    public textLabel: Label | null = null;  

    @property({ type: Sprite })
    public guideSprite: Sprite | null = null;

    @property({ type: Node })
    public clickBtnNode: Node | null = null;  
    
    @property({ type: Widget })
    public nodeWidget: Widget | null = null;

    @property(AudioSource)
    public audioSource: AudioSource = null!;

    private waterHeight = 300
    private adIsShow = false
    private completeCallback: (isEnded: boolean) => void = null
    private isEnded = false
    private firstClick = true

    onLoad() {
        let width = screen.windowSize.width / view.getScaleX()
        let height = screen.windowSize.height / view.getScaleY()
        let size =  new Size(width, height)
        this.node.getComponent(UITransform).setContentSize(size)
    }

    start() {
        tween(this.guideSprite.node).repeatForever(tween().by(0.2, { position: new Vec3(-30, 0) }).by(0.2, { position: new Vec3(30, 0) })).start()
        this.clickBtnNode.on(Input.EventType.TOUCH_END, this.addBtnClick, this);
        this.closeButtonNode.on(Input.EventType.TOUCH_END, this.close, this);
    }

    asyncShow = (desText: string) => {
        return new Promise<{ isEnded: boolean}>(async (resolve) => {
            this.show(desText, (isEnded) => {
                resolve({ isEnded: isEnded})
            })
        }) 
    }

    show = async (desText: string, completeCallback: ((isEnded: boolean) => void)) => {
        this.completeCallback = completeCallback
        this.closeButtonNode.active = false
        setTimeout(() => {
            this.closeButtonNode.active = true
        }, 5000);
        this.node.active = true;
        this.adIsShow = false;
        this.isEnded = false
        this.firstClick = true
        this.waterSprite.node.getComponent(UITransform).setContentSize(500, 0)
        this.waterHeight = 200 + 150 * Math.random()
        setTimeout(() => {
            BannerAdManager.inst.hideAll()
        }, 1000);

        if (EnvUtils.HUAWEI()) {
            this.nodeWidget.bottom = 50
        } else if (EnvUtils.XIAOMI()) {
            this.nodeWidget.bottom = 80
        } else if (EnvUtils.OPPO()) {
            this.nodeWidget.bottom = 80
        } else if (EnvUtils.VIVO()) {
            this.nodeWidget.bottom = 50
        }else {
            this.nodeWidget.bottom = 20
        }

        this.textLabel.string = desText
    }

    addBtnClick() {
        this.audioSource.play()
        this.guideSprite.node.active = false
        let height = this.waterSprite.node.getComponent(UITransform).height + 40
        this.waterSprite.node.getComponent(UITransform).setContentSize(500, height)
        if (this.waterSprite.node.getComponent(UITransform).height >= this.waterHeight) {
            this.complete()
        }
    }

    complete = () => {
        if (this.adIsShow) {
            return
        }
        this.adIsShow = true

        if (EnvUtils.OPPO() || EnvUtils.VIVO() || EnvUtils.HUAWEI() || EnvUtils.XIAOMI() || EnvUtils.RONGYAO()) {
            RewardedVideoAdManager.inst.show(null, (success: boolean, isEnded: boolean) => {
                this.isEnded = true
                this.close()
            })
            return
        } 

        this.isEnded = true
        this.close()
    }

    close() {
        NativeAdManager.inst.clean()
        this.node.active = false
        if (this.completeCallback) {
            this.completeCallback(this.isEnded)
        }
    }

    update(deltaTime: number) {
        let height = this.waterSprite.node.getComponent(UITransform).height - 1
        if (height < 0) {
            height = 0
        }
        this.waterSprite.node.getComponent(UITransform).setContentSize(500, height)
    }
}

