import { _decorator, AudioClip, Color, Component, Font, Label, Node, tween, UIOpacity, Vec3,  } from "cc";
import { OpenAPIManager } from "../platform/OpenAPIManager";
import { RewardedVideoAdManager } from "../ad/RewardedVideoAdManager";
import { AdGlobal, ShowMoreAdType } from "../dispose/AdGlobal";

const { ccclass, property } = _decorator;

@ccclass('MuYuAlert')
export class MuYuAlert extends Component {

    @property({ type: Label })
    public subTitle: Label | null = null;

    private addTextDex: string = '功德'
    private callback: (success: boolean) => void = null
    public completeCallback: (success: boolean) => void = null
    private addCount: number = 1
    private maxCount: number = 10
    private currentCount: number = 0
    private completed: boolean = false
    private closeCount: number = 0
    private textColor: string = '#F8BD31'

    init = (callback: (success: boolean) => void) => {
        this.subTitle.string = `差${(this.maxCount - this.currentCount)}功德无限畅玩`
        this.completed = false
        this.closeCount = 0
        this.callback = callback
        this.node.active = true;

        this.node.getChildByName('GuideSprite').active = false
        OpenAPIManager.inst.getStorage('resultMuyuNodeShowed', false, (success, data) => {
            if (!data) {
                this.node.getChildByName('GuideSprite').active = true
                tween(this.node.getChildByName('GuideSprite')).repeatForever(tween().by(0.5, { position: new Vec3(-30, 0) }).by(0.5, { position: new Vec3(30, 0) })).start()
            } else {
                this.node.getChildByName('GuideSprite').active = false
            }
            OpenAPIManager.inst.setStorage('resultMuyuNodeShowed', 'true', false, () => { })
        })
    }

    muyuClick() {
        if (this.completed) {
            return
        }
        this.node.getChildByName('GuideSprite').active = false
        this.showScoreText(this.addCount)
        this.currentCount += this.addCount
        this.subTitle.string = `差${(this.maxCount - this.currentCount)}功德无限畅玩`
        if (this.currentCount >= this.maxCount) {
            if (this.callback) {
                this.callback(true)
            }
            if (this.completeCallback) {
                this.completeCallback(true)
            }
            this.node.active = false
            this.completed = true
        }
    }

   showScoreText(socre: number) {
        let scoreTextNode = new Node()
        let scoreTextLabel = scoreTextNode.addComponent(Label)
        let scoreTextOpacity = scoreTextNode.addComponent(UIOpacity)
        scoreTextLabel.fontSize = 40
        scoreTextLabel.isBold = true
        scoreTextLabel.color = new Color(this.textColor)
        scoreTextLabel.string = `${this.addTextDex} +${socre}`
        scoreTextLabel.node.layer = this.node.layer;
        this.node.addChild(scoreTextNode)
        scoreTextNode.setPosition(0, 120)

        tween(scoreTextNode).
        by(1.3, { position: new Vec3(0, 150) }, {easing: "fade", onComplete: (target?: object) => {
            scoreTextNode.removeFromParent()
        }}).
        start()

        tween(scoreTextOpacity).
        to(1.3, { opacity: 0 }, {easing: "fade"}).
        start()
    }

    adGetClick() {
        if (AdGlobal.adType === ShowMoreAdType.HIGH) {
            this.muyuClick()
            return
        }

        if (this.completed) {
            return
        }

        RewardedVideoAdManager.inst.show(null, (success: boolean, isEnded: boolean) => {
            if (this.callback) {
                this.callback(true)
            }
            if (this.completeCallback) {
                this.completeCallback(true)
            }
            this.node.active = false
            this.completed = true
        })
    }

    closeClick() {
        this.closeCount++
        if (AdGlobal.adType === ShowMoreAdType.HIGH && this.closeCount < 3) {
            return
        }
        this.completed = true
        this.node.active = false
        if (this.callback) {
            this.callback(false)
        }
        if (this.completeCallback) {
            this.completeCallback(false)
        }
    }

    isShow = () => {
        return this.node.active;
    }   
}

