import { AdGlobal } from "../dispose/AdGlobal";
import { AdUnitIdKey } from "../platform/Base/BaseOpenAPI";
import { AdUtils } from "../utils/AdUtils";
import { OpenAPIManager } from "../platform/OpenAPIManager";
import { PreVideoStatus, RewardedVideoAdManager, VideoAdKeyList } from "./RewardedVideoAdManager";

const SHOW_LOG = true

export class RewardedVideoWaterfall {
    private static _inst: RewardedVideoWaterfall;
    public static get inst(): RewardedVideoWaterfall {
        if (this._inst == null) {
            this._inst = new RewardedVideoWaterfall();
        }
        return this._inst;
    }

    private adIndex = 0
    private adList: RewardedVideoAdManager[] = []
    private adKeyLoadList: AdUnitIdKey[] = []

    private checkAdKeyIsLoad = (adKey: AdUnitIdKey) => {
        let adId = OpenAPIManager.inst.getAdUnitId(adKey)
        for (let index = 0; index < this.adList.length; index++) {
            const adItem = this.adList[index];
            if (adItem.currentAdId === adId) {
                return true
            }
        }

        for (let index = 0; index < this.adKeyLoadList.length; index++) {
            const loadAdKey = this.adKeyLoadList[index];
            if (loadAdKey === adKey) {
                return true
            }
        }

        return false
    }

    public addNewAdToList = async (addCount: number) => {

        for (let index = 0; index < 100000; index++) {
            if (window["showStartVideoWillShow"] && !window["showStartVideoShowed"]) {
                await AdUtils.timeOut(200)
                continue
            }
        }

        if (this.adList.length >= VideoAdKeyList.length) {
            return
        }


        SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList call')
        let loadPromiseList = []
        let loadAdList:RewardedVideoAdManager[] = []
        for (let index = 0; index < addCount; index++) {
            let adKey = null
            for (let addIndex = 0; addIndex < VideoAdKeyList.length; addIndex++) {
                let noCheckAdKey = VideoAdKeyList[this.adIndex % VideoAdKeyList.length];
                this.adIndex++
                if (!this.checkAdKeyIsLoad(noCheckAdKey)) {
                    adKey = noCheckAdKey
                    SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList noCheckAdKey is OK', noCheckAdKey)
                    break
                }

                SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList noCheckAdKey is load', noCheckAdKey)
            }

            if (!adKey) {
                SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList 无可用 adKey 了')
                break
            }
           
            SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList adKey addToList', adKey)
            let adItem = new RewardedVideoAdManager()
            adItem.needEndPreload = false
            loadPromiseList.push(adItem.asyncPreloadAd(adKey))
            loadAdList.push(adItem)
            this.adKeyLoadList.push(adKey)
        }

        SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList 开始加载', loadPromiseList.length)
        await Promise.all(loadPromiseList)
        SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList 加载完成')

        for (let index = 0; index < loadAdList.length; index++) {
            const adItem = loadAdList[index];
            SHOW_LOG && console.log('[RewardedVideoWaterfall] addNewAdToList 加载完成 adItem', adItem.currentEcpm, adItem.videoStatus)
            if (adItem.currentEcpm > 0 && adItem.videoStatus === PreVideoStatus.Ready) {
                this.adList.push(adItem)
            }
        }
        this.adKeyLoadList = []
    }

    public asyncShow = async (subkey?: AdUnitIdKey, play: boolean = true) => {
        if (!AdGlobal.multipleAd) {
            return RewardedVideoAdManager.inst.asyncShow(subkey, play)
        }

        SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow call', this.adList.length)
        for (let index = 0; index < 25; index++) {
            if (this.adList.length > 0) {
                break
            }else{
                SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow wait!')
                await AdUtils.timeOut(200)
            }
        }

        if (!this.adList || this.adList.length === 0) {
            this.addNewAdToList(3)
            return {success: false, isEnded: false}
        }

        this.adList = this.adList.sort((a, b) => b.currentEcpm - a.currentEcpm);
        SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow this.adList.sort!',this.adList.map((a)=>{return {ecpm: a.currentEcpm, id: a.currentAdId}}))
        let maxEcpmAd = this.adList.shift()
        SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow maxEcpmAd!',maxEcpmAd.currentEcpm)
        let showResult = await maxEcpmAd.asyncShow()
        SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow showResult!',showResult)
        if (showResult && !showResult.success && !showResult.needClean) {
            this.adList.push(maxEcpmAd)
        }else{
            if (this.adList.length < 2) {
                this.addNewAdToList(2)
            }else{
                this.addNewAdToList(1)
            }
        }

        return showResult
    }

}