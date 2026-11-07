import { _decorator, AudioSource, Component, Label, Node, ProgressBar, Sprite, tween, UITransform, Vec3, Widget } from 'cc';

import { BannerAdManager } from '../ad/BannerAdManager';
import { RewardedVideoAdManager } from '../ad/RewardedVideoAdManager';
import { AdUnitIdKey } from '../platform/Base/BaseOpenAPI';
import { NativeAdManager } from './NativeAdNode';
import { CustomAdManager } from '../ad/CustomAdManager';
import { EnvUtils } from '../utils/EnvUtils';
const { ccclass, property } = _decorator;

@ccclass('ClickShowAdBottomNode')
export class ClickShowAdBottomNode extends Component {
    @property({ type: ProgressBar })
    public progressBar: ProgressBar | null = null;

    @property({ type: Label })
    public buttonText: Label | null = null;

    @property({ type: Sprite })
    public guideSprite: Sprite | null = null;

    @property({ type: Node })
    public clickBtnNode: Node | null = null;

    @property({ type: Widget })
    public nodeWidget: Widget | null = null;

    @property(AudioSource)
    public audioSource: AudioSource = null!;


    private adIsShow = false
    private customAdShow = false
    private completeNumber = 0.6
    private completeCallback: (success: boolean)=>void = null

    show = (key: string, completeCallback: (success: boolean)=>void) => {
        
        if (key === 'game') {
            this.buttonText.string = '获取提示'
        }
        
        if (key === 'result') {
            this.buttonText.string = '双倍奖励'
        }

        if (EnvUtils.HUAWEI() || EnvUtils.RONGYAO()) {
            this.nodeWidget.bottom = 50
        }else if (EnvUtils.XIAOMI()) {
            this.nodeWidget.bottom = 80
        }else {
            this.nodeWidget.bottom = 20
        }

        this.completeCallback = completeCallback
        this.node.active = true
        this.progressBar.node.active = false
        this.progressBar.progress = 0
        this.adIsShow = false
        this.customAdShow = false
        this.guideSprite.node.active = true
        this.guideSprite.node.setPosition(new Vec3(100, 0));
        tween(this.guideSprite.node).repeatForever(tween().by(0.2, { position: new Vec3(-30, 0) }).by(0.2, { position: new Vec3(30, 0) })).start()

        this.completeNumber = 0.4 + 0.3 * Math.random()
        BannerAdManager.inst.hideAll()
        this.showAd()
    }

    showAd = () => {
        
    }

    close(){
        NativeAdManager.inst.clean()
        this.node.active = false
    }

    addBtnClick(){
        this.guideSprite.node.active = false
        this.progressBar.node.active = true
        this.audioSource.play()
        this.progressBar.progress = this.progressBar.progress + 0.1
        if (this.progressBar.progress >= this.completeNumber) {
            this.complete()
        }
    }

    complete = () => {
        if (this.adIsShow) {
            return
        }
        this.adIsShow = true

        if (EnvUtils.OPPO() || EnvUtils.VIVO() || EnvUtils.HUAWEI() || EnvUtils.XIAOMI() || EnvUtils.RONGYAO()) {
            RewardedVideoAdManager.inst.show(AdUnitIdKey.Rewarded1,(success: boolean, isEnded: boolean) => {
                if (!this.customAdShow && !success) {
                    CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => {})
                    this.customAdShow = true
                }
                this.resultCallBack(true)
            })
            return
        }

        if (EnvUtils.WECHAT()) {
            CustomAdManager.inst.show(null, (success: boolean, isEnded: boolean) => {})
            setTimeout(() => {
                this.resultCallBack(true)
            }, 1000);
            return
        }

        this.resultCallBack(true)
    }

    resultCallBack = (success: boolean) => {
        NativeAdManager.inst.clean()
        this.node.active = false
        if (this.completeCallback) {
            this.completeCallback(success)
        }
    }


    update(deltaTime: number) {
        if (this.progressBar.progress <= 0) {
            return
        }
        this.progressBar.progress = this.progressBar.progress - 0.002
    }
}

