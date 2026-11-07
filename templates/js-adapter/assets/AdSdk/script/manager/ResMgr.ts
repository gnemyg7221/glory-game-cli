import { Asset, assetManager, AssetManager, AudioClip, ImageAsset, JsonAsset, Material, Prefab, resources, sp, SpriteAtlas, SpriteFrame, Texture2D } from "cc"
import { AdGlobal } from "../dispose/AdGlobal"

export interface AssetData {
    type: any
    path: string
}


export interface BundleData {
    url?: any
    key: string
    path?: string
}

export const AssetType: { [Key: string]: AssetData } = ({
    Prefab: { type: Prefab, path: "Prefabs/" },
    Sound: { type: AudioClip, path: "Clips/" },
    Atlas: { type: SpriteAtlas, path: "Atlas/" },
    SpriteFrames: { type: SpriteFrame, path: "SpriteFrames/" },
    Json: { type: JsonAsset, path: "Jsons/" },
    Material: { type: Material, path: "Mats/" }
})

export const BundleInfo: { [Key: string]: BundleData } = {
    Adbundle: { key: 'Adbundle', path: 'Adbundle' },
}

export default class ResMgr {

    public needReleaseBundle: string[] = []

    private abBundleMap: { [key: string]: AssetManager.Bundle } = {};
    private atlasMap: { [key: string]: { [key: string]: SpriteAtlas } } = {};
    private prefabMap: { [key: string]: { [key: string]: Prefab } } = {};

    private spfsMap: { [key: string]: { [key: string]: SpriteFrame } } = {};
    private jsonAssetMap: { [key: string]: { [key: string]: JsonAsset } } = {};
    private clipMap: { [key: string]: { [key: string]: AudioClip } } = {};
    private spineMap: { [key: string]: { [key: string]: sp.SkeletonData } } = {};

    private loadStemp = null;
    private loadTime = 0;
    private totalTime = 0
    
    private imageCache: { [key: string]: SpriteFrame } = {};


    private static _ins: ResMgr;
    public static get ins(): ResMgr {
        if (this._ins == null) {
            this._ins = new ResMgr();
        }
        return this._ins;
    }

    constructor() {
        this.abBundleMap['resources'] = resources
    }

    printTimer(name: string = "", end = false) {
        this.loadTime = Date.now() - this.loadStemp;
        this.loadStemp = Date.now();
        this.totalTime += this.loadTime
        AdGlobal.canLog && console.log(name + "，load time===", this.loadTime, "ms")
        if (end) {
            AdGlobal.canLog && console.log("Load finish, total time===", this.totalTime, "ms")
        }

    }

    /**
     * @description: Load assetbundle based on index
     * @param {number} index
     * @param {number} ratio
     * @return {*}
     */
    public async loadBundle(bundlePath: string, bundleKey: string): Promise<void> {
        if (!this.loadStemp) {
            this.loadStemp = Date.now();
        }

        return new Promise<void>((resolve, reject) => {
            this.printTimer("Bundle: <" + bundlePath + "> " + "load start")

            if (this.abBundleMap[bundleKey]) {
                this.printTimer("Bundle: <" + bundlePath + "> " + "Bundle 已加载")
                resolve && resolve();
                return
            }

            assetManager.loadBundle(bundlePath, (err: any, bundle: AssetManager.Bundle) => {
                if (err) {
                    AdGlobal.canLog && console.error("Bundle: <" + bundlePath + "> load error, error==", err)
                } else {
                    this.abBundleMap[bundleKey] = bundle;
                    this.printTimer("Bundle: <" + bundlePath + "> " + "load success")
                    resolve && resolve();
                }
            })
        })
    }

    public async loadBundleWithUrl(bundleUrl: string, bundleKey: string): Promise<void> {
        if (!this.loadStemp) {
            this.loadStemp = Date.now();
        }

        return new Promise<void>((resolve, reject) => {
            assetManager.loadBundle(bundleUrl, (err: any, bundle: AssetManager.Bundle) => {
                if (err) {
                    AdGlobal.canLog && console.error("Bundle" + bundleUrl + " load error, error==", err)
                } else {
                    AdGlobal.canLog && console.log('loadBundleWithUrl success:', bundle)
                    this.abBundleMap[bundleKey] = bundle;
                    this.printTimer("Bundle" + bundleUrl + "__" + "load success")
                    resolve && resolve();
                }
            })
        })
    }

    public getBundle = (key: string) => {
        return this.abBundleMap[key];
    }


    public releaseDiscardBundle = () => {
        if (this.needReleaseBundle) {
            this.needReleaseBundle.forEach((key) => {
                this.cleanBundle(key)
                AdGlobal.canLog && console.log("releaseDiscardBundle key==", key)
            })
            this.needReleaseBundle = []
        }
    }

    public cleanBundle = (key: string) => {
        this.cleanAtlas(key)
        this.cleanClip(key)
        this.cleanJson(key)
        this.cleanSpfs(key)
        this.cleanSpine(key)
        this.cleanPrefab(key)
        let bundle = this.abBundleMap[key]
        bundle.releaseAll();
        assetManager.removeBundle(bundle);
    }


    public async loadRes(bunldekey: string, type: any): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            if (!this.abBundleMap[bunldekey]) {
                resolve && resolve(false);
                return
            }
            this.abBundleMap[bunldekey].loadDir(type.path, type.type, (finished: number, total: number) => {
            }, (err: any, assets: any[]) => {

                if (err) {
                    AdGlobal.canLog && console.error("Error===", err);
                    resolve && resolve(false);
                }
                let asset: any
                if (type == AssetType.Sound) {
                    for (let i = 0; i < assets.length; i++) {
                        asset = assets[i];
                        this.setClip(bunldekey, asset.name, asset)
                        AdGlobal.canLog && console.log("clip name==", asset.name)
                    }
                }
                if (type == AssetType.Atlas) {
                    for (let i = 0; i < assets.length; i++) {
                        asset = assets[i];
                        this.setAtlas(bunldekey, asset.name, asset)
                        AdGlobal.canLog && console.log("atlas name==", asset.name)
                    }
                }
                if (type == AssetType.SpriteFrames) {
                    for (let i = 0; i < assets.length; i++) {
                        asset = assets[i];
                        this.setSpfs(bunldekey, asset.name, asset)
                        AdGlobal.canLog && console.log("Spfs name==", asset.name)
                    }
                }
                if (type == AssetType.Json) {
                    for (let i = 0; i < assets.length; i++) {
                        asset = assets[i];
                        this.setJson(bunldekey, asset.name, asset)
                        AdGlobal.canLog && console.log("json name==", asset.name)
                    }
                }

                if (type == AssetType.Spine) {
                    for (let i = 0; i < assets.length; i++) {
                        asset = assets[i];
                        this.setSpine(bunldekey, asset.name, asset)
                        AdGlobal.canLog && console.log("spine name==", asset.name)
                    }
                }

                if (type == AssetType.Prefab) {
                    for (let i = 0; i < assets.length; i++) {
                        asset = assets[i];
                        this.setPrefab(bunldekey, asset.name, asset)
                        AdGlobal.canLog && console.log("Prefab name==", asset.name)
                    }
                }
                this.printTimer("Bundle" + bunldekey + "__" + type.path + "loaded success")

                resolve && resolve(true);
            })
        })
    }

    public async getRes(bunldekey: string, name, type: any): Promise<Asset> {
        return new Promise<Asset>((resolve) => {
            if (!this.abBundleMap[bunldekey]) {
                resolve && resolve(null);
                return
            }

            this.abBundleMap[bunldekey].load(name, type, (finished: number, total: number) => {
            }, (err: any, assets: any) => {
                if (err) {
                    AdGlobal.canLog && console.error("Error===", err);
                    resolve && resolve(null);
                }

                resolve && resolve(assets);
            })
        })
    }


    public getAtlas(bundle: string, name: string): SpriteAtlas {
        if (this.atlasMap[bundle] && this.atlasMap[bundle][name]) {
            return this.atlasMap[bundle][name]
        } else {
            return null
        }
    }

    public setAtlas(bundle: string, name: string, asset: SpriteAtlas) {
        if (!this.atlasMap[bundle]) {
            this.atlasMap[bundle] = {}
        }
        this.atlasMap[bundle][name] = asset
    }

    public cleanAtlas(bundle: string, name?: string) {
        if (name && this.atlasMap[bundle]) {
            this.atlasMap[bundle][name] = null
        } else {
            this.atlasMap[bundle] = {}
        }
    }

    public getPrefab(bundleKey: string, name: string): Promise<Prefab> {
        return new Promise<Prefab>(async (resolve) => {
            if (!ResMgr.ins.getBundle(bundleKey)) {
                let bundleData = BundleInfo[bundleKey]
                await ResMgr.ins.loadBundle(bundleData.path, bundleData.key)
            }
            if (this.prefabMap[bundleKey] && this.prefabMap[bundleKey][name]) {
                resolve(this.prefabMap[bundleKey][name]);
            } else {
                let bundle = this.abBundleMap[bundleKey]
                if (bundle) {
                    bundle.load(AssetType.Prefab.path + name, AssetType.Prefab.type, (finished: number, total: number) => {
                    }, (err: any, assets: any) => {
                        if (err) {
                            AdGlobal.canLog && console.error("Error===", err);
                            resolve(null);
                            return
                        }
                        this.setPrefab(bundleKey, name, assets)
                        resolve(assets);
                    })
                } else {
                    resolve(null)
                }
            }
        })
    }

    public setPrefab(bundle: string, name: string, asset: Prefab) {
        if (!this.prefabMap[bundle]) {
            this.prefabMap[bundle] = {}
        }
        this.prefabMap[bundle][name] = asset
    }

    public cleanPrefab(bundle: string, name?: string) {
        if (name && this.prefabMap[bundle]) {
            this.prefabMap[bundle][name] = null
        } else {
            this.prefabMap[bundle] = {}
        }
    }

    async getSpfsWithUrl(remoteUrl: string): Promise<SpriteFrame> {
        return new Promise<SpriteFrame>((resolve, reject) => {
            if (this.imageCache[remoteUrl]) {
                resolve(this.imageCache[remoteUrl])
                return
            }

            let option = null
            if (!this.getExtensionFromUrl(remoteUrl)) {
                option = { ext: '.jpg' }
            }
            assetManager.loadRemote<ImageAsset>(remoteUrl, option, (err, imageAsset) => {
                if (!imageAsset) {
                    resolve(null)
                    return
                }
                const spriteFrame = new SpriteFrame();
                const texture = new Texture2D();
                try {
                    texture.image = imageAsset;
                } catch (error) {
                    AdGlobal.canLog && console.log('error', JSON.stringify(error))
                }
                spriteFrame.texture = texture;
                this.imageCache[remoteUrl] = spriteFrame;
                resolve(spriteFrame)
            });
        })
    }

    public getSpfs(bundleKey: string, name: string): Promise<SpriteFrame> {
        return new Promise<SpriteFrame>(async (resolve) => {

            if (!bundleKey || !name) {
                resolve(null)
                return
            }

            if (!ResMgr.ins.getBundle(bundleKey)) {
                let bundleData = BundleInfo[bundleKey]
                if (bundleData) {
                    await ResMgr.ins.loadBundle(bundleData.path, bundleData.key)
                }
            }
            if (this.spfsMap[bundleKey] && this.spfsMap[bundleKey][name]) {
                resolve(this.spfsMap[bundleKey][name]);
            } else {
                let bundle = this.abBundleMap[bundleKey]
                if (bundle) {
                    bundle.load(AssetType.SpriteFrames.path + name, AssetType.SpriteFrames.type, (finished: number, total: number) => {
                    }, (err: any, assets: any) => {
                        if (err) {
                            AdGlobal.canLog && console.error("Error===", err);
                            resolve(null);
                            return
                        }
                        this.setSpfs(bundleKey, name, assets)
                        resolve(assets);
                    })
                } else {
                    resolve(null)
                }
            }
        })
    }

    public setSpfs(bundle: string, name: string, asset: SpriteFrame) {
        if (!this.spfsMap[bundle]) {
            this.spfsMap[bundle] = {}
        }
        this.spfsMap[bundle][name] = asset
    }

    public cleanSpfs(bundle: string, name?: string) {
        if (name && this.spfsMap[bundle]) {
            this.spfsMap[bundle][name] = null
        } else {
            this.spfsMap[bundle] = {}
        }
    }


    public getJson(bundle: string, name: string): JsonAsset {
        if (this.jsonAssetMap[bundle] && this.jsonAssetMap[bundle][name]) {
            return this.jsonAssetMap[bundle][name]
        } else {
            return null
        }
    }
    public setJson(bundle: string, name: string, asset: JsonAsset) {
        if (!this.jsonAssetMap[bundle]) {
            this.jsonAssetMap[bundle] = {}
        }
        this.jsonAssetMap[bundle][name] = asset
    }

    public cleanJson(bundle: string, name?: string) {
        if (name && this.jsonAssetMap[bundle]) {
            this.jsonAssetMap[bundle][name] = null
        } else {
            this.jsonAssetMap[bundle] = {}
        }
    }

    public getSpine(bundle: string, name: string): sp.SkeletonData {
        if (this.spineMap[bundle] && this.spineMap[bundle][name]) {
            return this.spineMap[bundle][name]
        } else {
            return null
        }
    }
    public setSpine(bundle: string, name: string, asset: sp.SkeletonData) {
        if (!this.spineMap[bundle]) {
            this.spineMap[bundle] = {}
        }
        this.spineMap[bundle][name] = asset
    }

    public cleanSpine(bundle: string, name?: string) {
        if (name && this.spineMap[bundle]) {
            this.spineMap[bundle][name] = null
        } else {
            this.spineMap[bundle] = {}
        }
    }


    public getClip(bundleKey: string, name?: string): Promise<AudioClip> {

        return new Promise<AudioClip>(async (resolve) => {
            if (!ResMgr.ins.getBundle(bundleKey)) {
                let bundleData = BundleInfo[bundleKey]
                await ResMgr.ins.loadBundle(bundleData.path, bundleData.key)
            }
            if (this.clipMap[bundleKey] && this.clipMap[bundleKey][name]) {
                resolve(this.clipMap[bundleKey][name]);
            } else {
                let bundle = this.abBundleMap[bundleKey]
                if (bundle) {
                    bundle.load(AssetType.Sound.path + name, AssetType.Sound.type, (finished: number, total: number) => {
                    }, (err: any, assets: any) => {
                        if (err) {
                            AdGlobal.canLog && console.error("Error===", err);
                            resolve(null);
                            return
                        }
                        this.setClip(bundleKey, name, assets)
                        resolve(assets);
                    })
                } else {
                    resolve(null)
                }
            }
        })
    }

    public setClip(bundle: string, name: string, asset: any) {
        if (!this.clipMap[bundle]) {
            this.clipMap[bundle] = {}
        }
        this.clipMap[bundle][name] = asset
    }

    public cleanClip(bundle: string, name?: string) {
        if (name && this.clipMap[bundle]) {
            this.clipMap[bundle][name] = null
        } else {
            this.clipMap[bundle] = {}
        }
    }

    private getExtensionFromUrl(url: string) {
        const regex = /\.([^./?#]+)(?:[?#]|$)/;
        const match = url.match(regex);
        return match? match[1] : '';
    }

}