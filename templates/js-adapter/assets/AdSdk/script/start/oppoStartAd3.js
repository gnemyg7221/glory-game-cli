const SHOW_LOG = false

var getLaunchOptionsSync = function getLaunchOptionsSync() {
    var _globalThis$qg, _globalThis$qg2, _globalThis$qg3, _globalThis$qg3$getEn;
    var startData = (globalThis === null || globalThis === void 0 || (_globalThis$qg = globalThis.qg) === null || _globalThis$qg === void 0 ? void 0 : _globalThis$qg.getLaunchOptionsSync()) || (globalThis === null || globalThis === void 0 || (_globalThis$qg2 = globalThis.qg) === null || _globalThis$qg2 === void 0 ? void 0 : _globalThis$qg2.getNavigateOptionsSync()) || (globalThis === null || globalThis === void 0 || (_globalThis$qg3 = globalThis.qg) === null || _globalThis$qg3 === void 0 || (_globalThis$qg3$getEn = _globalThis$qg3.getEnterOptionsSync) === null || _globalThis$qg3$getEn === void 0 ? void 0 : _globalThis$qg3$getEn.call(_globalThis$qg3));
    return startData;
};

var startData = getLaunchOptionsSync()

let channel = null
let version = '1.0.0'
let appKey = 'com.null.nearme.gamecenter'
let companyKey = 'GRJH'
let uid = getUuid()
let clickId = null
let oaid = null
let adIncome = 0
let adShowCount = 0
let uploadAdIncome = 30
let adList = []
let needReloadIdList = []
let isRestart = false
var appShowed = true
let loseEcpm = 420
let saveMaxEcpmCount = 2
let skipCheckLose = false
let uploadAttrComplete = false
let adShowCheckInfo = [
    { ecpm: 0, adShowCount: 26 },
    { ecpm: 1050, adShowCount: 49 },
    { ecpm: 2040, adShowCount: 68 },
    { ecpm: 3010, adShowCount: 82 },
    { ecpm: 4010, adShowCount: 101 }
]

if (startData && startData.query) {
    channel = startData.query.channel
    clickId = startData.query.clickId
}

// channel = 'aag0n7oo5u'

var adIdList = [];

// 瀑布流
var loadStartVideo = function (adUnitId) {
    return new Promise((resolve) => {
        let platObj = globalThis.qg;
        if (!platObj.createRewardedVideoAd) {
            resolve({ adUnitId: adUnitId })
            return
        }
        var rewardedVideoAd = platObj.createRewardedVideoAd({ adUnitId: adUnitId })
        if (!rewardedVideoAd) {
            resolve({ adUnitId: adUnitId })
            return;
        }
        rewardedVideoAd.onError && rewardedVideoAd.onError(function (res) {
            let errMsg = res.errMsg
            let errCode = res.errCode
            uploadEventData('ad_load_error_Rewarded', 'frequency')
            uploadErrorMsg(errCode, errMsg + `[类型: 激励  adUnitId: ${adUnitId}]`)
            rewardedVideoAd.destroy()
            resolve({ adUnitId: adUnitId })
        })

        rewardedVideoAd.onLoad && rewardedVideoAd.onLoad(function (data) {
            let ecpm = 1
            if (data && data.ECPM && data.ECPM.ECPMCode === 0 && data.ECPM.ECPMPrice > 0) {
                let becpm = data.ECPM.ECPMPrice
                becpm = Math.round(becpm)
                if (becpm < 1) {
                    becpm = 1
                }
                
                ecpm = becpm
            }
            resolve({ ecpm: ecpm, adObj: rewardedVideoAd, adUnitId: adUnitId })

        })
        rewardedVideoAd.load && rewardedVideoAd.load();
    })
}
var TOP_ECPM_STORAGE_KEY = 'startAdTopEcpmInfo'

function readTopEcpmFromStorage() {
    try {
        if (!localStorage) {
            return []
        }
        var raw = localStorage.getItem(TOP_ECPM_STORAGE_KEY)
        if (!raw) {
            return []
        }
        var data = JSON.parse(raw)
        var list = []
        if (Array.isArray(data)) {
            list = data
        } else if (data && Array.isArray(data.list)) {
            list = data.list
        }
        return list.filter(function (item) {
            return item && item.adUnitId && item.ecpm > 0
        })
    } catch (e) {
        return []
    }
}

/** 用当前广告池覆盖存储，保留 ecpm 最高的 N 条（数量由 saveMaxEcpmCount 控制） */
function updateTopEcpmStorage(loadResults) {
    var validList = []
    for (let i = 0; i < loadResults.length; i++) {
        var result = loadResults[i]
        if (result && result.adUnitId && result.ecpm > 0) {
            validList.push({ adUnitId: result.adUnitId, ecpm: result.ecpm })
        }
    }
    validList.sort(function (a, b) { return b.ecpm - a.ecpm })
    var saveCount = (typeof saveMaxEcpmCount === 'number' && saveMaxEcpmCount > 0) ? saveMaxEcpmCount : 2
    var topList = validList.slice(0, saveCount)
    try {
        if (localStorage) {
            localStorage.setItem(TOP_ECPM_STORAGE_KEY, JSON.stringify(topList))
            SHOW_LOG && console.log('[StartAd] updateTopEcpmStorage', topList)
        }
    } catch (e) {
        // ignore
    }
    return topList
}

var addNewAdToList = async (addCount, needAddIdList) => {
    SHOW_LOG && console.log('[StartAd] initWaterfall call addCount', addCount, needAddIdList)
    if (!adIdList || adIdList.length === 0 || addCount <= 0) {
        return
    }
    var existingIdSet = {}
    for (let i = 0; i < adList.length; i++) {
        if (adList[i] && adList[i].adUnitId) {
            existingIdSet[adList[i].adUnitId] = true
        }
    }

    var pickList = []
    var pickedSet = {}

    // 优先加入 needAddIdList（跳过已在 adList 中的）
    if (needAddIdList && needAddIdList.length > 0) {
        for (let i = 0; i < needAddIdList.length; i++) {
            var needId = needAddIdList[i]
            if (!needId || existingIdSet[needId] || pickedSet[needId]) {
                continue
            }
            pickList.push(needId)
            pickedSet[needId] = true
            if (pickList.length >= addCount) {
                break
            }
        }
    }

    // 剩余名额从 adIdList 中随机补齐（同样排除 adList / 已选）
    if (pickList.length < addCount) {
        var candidates = []
        for (let i = 0; i < adIdList.length; i++) {
            var id = adIdList[i]
            if (id && !existingIdSet[id] && !pickedSet[id]) {
                candidates.push(id)
                pickedSet[id] = true
            }
        }
        for (let i = candidates.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1))
            var tmp = candidates[i]
            candidates[i] = candidates[j]
            candidates[j] = tmp
        }
        var remain = addCount - pickList.length
        for (let i = 0; i < candidates.length && i < remain; i++) {
            pickList.push(candidates[i])
        }
    }

    if (pickList.length === 0) {
        return
    }

    var loadPromiseList = []
    for (let index = 0; index < pickList.length; index++) {
        const adId = pickList[index]
        SHOW_LOG && console.log('[StartAd] initWaterfall adKey addToList', index, adId)
        loadPromiseList.push(loadStartVideo(adId))
    }
    SHOW_LOG && console.log('[StartAd] initWaterfall 开始加载', loadPromiseList.length)
    let loadResultList = await Promise.all(loadPromiseList)
    SHOW_LOG && console.log('[StartAd] initWaterfall 加载完成', loadResultList)

    if (loadResultList.length === 0) {
        return
    }
    var successResults = []
    for (let index = 0; index < loadResultList.length; index++) {
        const adResult = loadResultList[index];
        if (!adResult || !adResult.adUnitId || adResult.ecpm <= 0 || !adResult.adObj) {
            if (adResult && adResult.adUnitId) {
                needReloadIdList.push(adResult.adUnitId)
            }
            continue
        }
        SHOW_LOG && console.log('[StartAd] initWaterfall 加载完成 adResult', adResult.ecpm, adResult.adUnitId)
        if (adResult && adResult.ecpm > 0 && adResult.adObj) {
            adList.push(adResult)
            successResults.push({ adUnitId: adResult.adUnitId, ecpm: adResult.ecpm })
        }
    }
    if (successResults.length > 0) {
        updateTopEcpmStorage(adList)
    }
}

/** 计算当前 adList 中广告的平均 ecpm，无有效广告时返回 0 */
function getAdListAvgEcpm() {
    if (!adList || adList.length === 0) {
        return 0
    }
    var total = 0
    var count = 0
    for (let i = 0; i < adList.length; i++) {
        var item = adList[i]
        if (item && item.ecpm > 0) {
            total += item.ecpm
            count++
        }
    }
    if (count === 0) {
        return 0
    }
    return total / count
}

var SHOW_ECPM_STATS_KEY = 'startAdShowEcpmStats'
var SHOW_ECPM_PERIOD_MS = 12 * 3600 * 1000

function getDefaultMaxCount() {
    if (adShowCheckInfo && adShowCheckInfo.length > 0 && adShowCheckInfo[0].adShowCount > 0) {
        return adShowCheckInfo[0].adShowCount
    }
    return 0
}

function loadShowEcpmStats() {
    var defaultMaxCount = getDefaultMaxCount()
    var fresh = function () {
        return { startTime: Date.now(), showCount: 0, totalEcpm: 0, maxCount: defaultMaxCount }
    }
    try {
        if (!localStorage) {
            return fresh()
        }
        var raw = localStorage.getItem(SHOW_ECPM_STATS_KEY)
        if (!raw) {
            return fresh()
        }
        var data = JSON.parse(raw)
        if (!data || typeof data.startTime !== 'number') {
            localStorage.removeItem(SHOW_ECPM_STATS_KEY)
            return fresh()
        }
        // 超过 12 小时：清缓存并重新开周期
        if (Date.now() - data.startTime >= SHOW_ECPM_PERIOD_MS) {
            localStorage.removeItem(SHOW_ECPM_STATS_KEY)
            return fresh()
        }
        return {
            startTime: data.startTime,
            showCount: typeof data.showCount === 'number' ? data.showCount : 0,
            totalEcpm: typeof data.totalEcpm === 'number' ? data.totalEcpm : 0,
            maxCount: (typeof data.maxCount === 'number' && data.maxCount > 0) ? data.maxCount : defaultMaxCount
        }
    } catch (e) {
        try {
            if (localStorage) {
                localStorage.removeItem(SHOW_ECPM_STATS_KEY)
            }
        } catch (err) {
            // ignore
        }
        return fresh()
    }
}

function saveShowEcpmStats(data) {
    try {
        if (localStorage) {
            localStorage.setItem(SHOW_ECPM_STATS_KEY, JSON.stringify(data))
        }
    } catch (e) {
        // ignore
    }
}

/** 按 maxCount 定位当前档位下标；未命中则回落到不超过 maxCount 的最高档 */
function getCurrentTierIndex(maxCount) {
    if (!adShowCheckInfo || adShowCheckInfo.length === 0) {
        return -1
    }
    for (let i = 0; i < adShowCheckInfo.length; i++) {
        if (adShowCheckInfo[i].adShowCount === maxCount) {
            return i
        }
    }
    var fallback = -1
    for (let i = 0; i < adShowCheckInfo.length; i++) {
        if (adShowCheckInfo[i].adShowCount <= maxCount) {
            fallback = i
        }
    }
    return fallback >= 0 ? fallback : 0
}

/**
 * 升档：必须先打满本档展示次数，且平均 ecpm ≥ 下一档门槛；档次只升不降
 */
function tryUpgradeTier(stats) {
    if (!adShowCheckInfo || adShowCheckInfo.length === 0) {
        return
    }
    if (!stats.maxCount) {
        stats.maxCount = getDefaultMaxCount()
    }
    if (stats.showCount <= 0) {
        return
    }
    var avgEcpm = stats.totalEcpm / stats.showCount
    while (true) {
        var currentIndex = getCurrentTierIndex(stats.maxCount)
        if (currentIndex < 0) {
            break
        }
        var nextIndex = currentIndex + 1
        if (nextIndex >= adShowCheckInfo.length) {
            break
        }
        var currentTier = adShowCheckInfo[currentIndex]
        var nextTier = adShowCheckInfo[nextIndex]
        // 仅升档：新 maxCount 必须大于当前值
        if (stats.showCount >= currentTier.adShowCount
            && avgEcpm >= nextTier.ecpm
            && nextTier.adShowCount > stats.maxCount) {
            stats.maxCount = nextTier.adShowCount
            SHOW_LOG && console.log('[StartAd] upgrade tier', currentIndex, '->', nextIndex, 'maxCount', stats.maxCount, 'avgEcpm', avgEcpm)
            continue
        }
        break
    }
}

/**
 * 记录一次展示的 ecpm：累计总展示次数和总 ecpm
 * 升档条件：打满本档次数 且 均价 ≥ 下一档门槛（只升不降）
 * 以 12 小时为周期，超时清零后重新计算
 * @param {number} ecpm
 * @returns {{ showCount: number, totalEcpm: number, maxCount: number }}
 */
function recordShowEcpm(ecpm) {
    var stats = loadShowEcpmStats()
    var addEcpm = (typeof ecpm === 'number' && ecpm > 0) ? ecpm : 0
    stats.showCount++
    stats.totalEcpm += addEcpm

    if (!stats.maxCount) {
        stats.maxCount = getDefaultMaxCount()
    }
    tryUpgradeTier(stats)

    saveShowEcpmStats(stats)
    SHOW_LOG && console.log('[StartAd] recordShowEcpm', stats)
    return {
        showCount: stats.showCount,
        totalEcpm: stats.totalEcpm,
        maxCount: stats.maxCount || getDefaultMaxCount()
    }
}

/**
 * 读取当前 12 小时周期内的总展示次数、总 ecpm 和 maxCount
 * @returns {{ showCount: number, totalEcpm: number, maxCount: number }}
 */
function getShowEcpmStats() {
    var stats = loadShowEcpmStats()
    return {
        showCount: stats.showCount,
        totalEcpm: stats.totalEcpm,
        maxCount: stats.maxCount || getDefaultMaxCount()
    }
}

var checkIsLose = () => {

    if (skipCheckLose) {
        return false
    }

    let currentInfo = getShowEcpmStats()
    if (currentInfo.showCount > 1 && currentInfo.totalEcpm > 0) {
        let avgEcpm = currentInfo.totalEcpm / currentInfo.showCount
        if (avgEcpm < loseEcpm) {
            SHOW_LOG && console.log('[StartAd] checkIsLose by loseEcpm', avgEcpm, loseEcpm)
            return true
        }
    }

    if (currentInfo.maxCount > 0 && currentInfo.showCount >= currentInfo.maxCount) {
        SHOW_LOG && console.log('[StartAd] checkIsLose by maxCount', currentInfo.showCount, currentInfo.maxCount)
        return true
    }

    return false
}

var showMutAd = async () => {

    if (checkIsLose()) {
        return null
    }

    if (!adList || adList.length === 0) {
        return null
    }
    uploadEventData('ad_request_Rewarded', 'frequency')
    adList = adList.sort((a, b) => b.ecpm - a.ecpm);
    SHOW_LOG && console.log('[StartAd] asyncShow dList.sort!', adList.map((a) => { return { ecpm: a.ecpm, id: a.adUnitId } }))
    let maxEcpmAd = adList.shift()
    SHOW_LOG && console.log('[StartAd] asyncShow maxEcpmAd!', maxEcpmAd.ecpm)
    recordShowEcpm(maxEcpmAd.ecpm)
    let showResult = null
    try {
        if (!maxEcpmAd.adObj || !maxEcpmAd.adObj.show) {
            return maxEcpmAd
        }
        showResult = await maxEcpmAd.adObj.show()
    } catch (e) {
        SHOW_LOG && console.log('[StartAd] asyncShow error!', e)
        return maxEcpmAd
    }
    SHOW_LOG && console.log('[StartAd] asyncShow showResult!', showResult)
    if (showResult && showResult.code === 0) {
        uploadEventData('ad_show_Rewarded', 'frequency')
        uploadEventData('ad_incom_Rewarded', 'number', maxEcpmAd.ecpm)
        if (!window["showStartVideoEcpmNum"]) {
            window["showStartVideoEcpmNum"] = 0
        }
        window["showStartVideoEcpmNum"] = window["showStartVideoEcpmNum"] + maxEcpmAd.ecpm

        adIncome += maxEcpmAd.ecpm
        adShowCount++
        if ((adIncome / 100) > uploadAdIncome && !uploadAttrComplete) {
            uploadAttrComplete = true
            uploadEventData('app_key_action_3', 'frequency')
            uploadAttributionData('KEY').then((success) => {
                if (success) {
                    uploadEventData('attribution_count', 'frequency')
                }
            })
        }

        return maxEcpmAd
    }
    return maxEcpmAd
}
// 非瀑布流
var showStartVideo = function (adUnitId) {
    uploadEventData('ad_request_Rewarded', 'frequency')
    return new Promise((resolve) => {
        let platObj = globalThis.qg;
        if (!platObj.createRewardedVideoAd) {
            resolve(false)
            return
        }
        var rewardedVideoAd = platObj.createRewardedVideoAd({ adUnitId: adUnitId })
        if (!rewardedVideoAd) {
            resolve(false)
            return;
        }
        rewardedVideoAd.onError && rewardedVideoAd.onError(function (res) {
            let errMsg = res.errMsg
            let errCode = res.errCode
            uploadEventData('ad_load_error_Rewarded', 'frequency')
            uploadErrorMsg(errCode, errMsg + `[类型: 激励  adUnitId: ${adUnitId} version: ${version}]`)

            rewardedVideoAd.destroy()
            resolve(false)
        })
        rewardedVideoAd.onClose && rewardedVideoAd.onClose(function (res) {
            rewardedVideoAd.destroy()
            resolve(true)
        })

        rewardedVideoAd.onLoad && rewardedVideoAd.onLoad(function (data) {
            if (!rewardedVideoAd.show) {
                resolve(false)
                return
            }
            rewardedVideoAd.show().then((data) => {
                if (data && data.isFallBack === 1) {
                    uploadEventData('ad_show_fallback_Rewarded', 'frequency')
                }
            })

            let ecpm = 1
            if (data && data.ECPM && data.ECPM.ECPMCode === 0 && data.ECPM.ECPMPrice > 0) {
                let becpm = data.ECPM.ECPMPrice
                becpm = Math.round(becpm)
                if (becpm < 1) {
                    becpm = 1
                }
                ecpm = becpm
            }

            uploadEventData('ad_show_Rewarded', 'frequency')
            uploadEventData('ad_incom_Rewarded', 'number', ecpm)

            if (!window["showStartVideoEcpmNum"]) {
                window["showStartVideoEcpmNum"] = 0
            }
            window["showStartVideoEcpmNum"] = window["showStartVideoEcpmNum"] + ecpm

            adIncome += ecpm
            adShowCount++
            if ((adIncome / 100) > uploadAdIncome && !uploadAttrComplete) {
                uploadAttrComplete = true
                uploadEventData('app_key_action_3', 'frequency')
                uploadAttributionData('KEY').then((success) => {
                    if (success) {
                        uploadEventData('attribution_count', 'frequency')
                    }
                })
            }

        })
        rewardedVideoAd.load && rewardedVideoAd.load();
    })
}
var showStartCustom = function (adUnitId) {
    return new Promise((resolve) => {
        let platObj = globalThis.qg;
        if (!platObj || !platObj.createCustomAd) {
            resolve(false)
            return
        }
        var customAd = platObj.createCustomAd({ adUnitId: adUnitId })
        if (!customAd) {
            resolve(false)
            return;
        }
        try {
            if (customAd.show) {
                customAd.show()
                resolve(true)
            } else {
                resolve(false)
            }
        } catch (e) {
            console.error('[StartAd] showStartCustom error:', e)
            resolve(false)
        }
    })
}
var showAd = async function (adIdList, adCount) {
    for (let index = 0; index < adCount; index++) {
        const adId = adIdList[index % adIdList.length];
        let success = await showStartVideo(adId)
        if (!success) {
            await timeOut(200)
        }
    }
}

async function showMoreAd(callback) {
    if (!channel) {
        callback && callback()
        return
    }

    let manifestInfo = await getManifestInfo()
    if (manifestInfo && manifestInfo.versionName) {
        version = manifestInfo.versionName
    }
    if (manifestInfo && manifestInfo.package) {
        appKey = manifestInfo.package
    }

    uploadEventData('app_start', 'frequency')
    window["startJsRun"] = true

    window["showStartVideoWillShow"] = true
    oaid = await getDeviceId()
    var gameConfig = await getGameConfig(appKey, channel, oaid, version)
    uploadAttributionData('START')
    window["startGameConfig"] = gameConfig
    if (!gameConfig || gameConfig.adType !== 'HIGH') {
        window["showStartVideoShowed"] = true
        callback && callback()
        return
    }

    let startCustomId = null
    if (gameConfig.adUnitIdEcpmInfo && Object.keys(gameConfig.adUnitIdEcpmInfo).length > 0) {
        for (let key in gameConfig.adUnitIdEcpmInfo) {
            if (gameConfig.adUnitIdEcpmInfo.hasOwnProperty(key)) {
                let value = gameConfig.adUnitIdEcpmInfo[key]
                if (value && value.type === "Rewarded" && value.adId && value.scene !== "game") {
                    adIdList.push(value.adId)
                }

                if (value && value.type === "CustomAd" && value.adId && !startCustomId && value.scene !== "game") {
                    startCustomId = value.adId
                }

            }
        }
    }

    if (!adIdList || adIdList.length === 0) {
        window["showStartVideoShowed"] = true
        callback && callback()
        return
    }

    var systemInfo = await getSystemInfo()
    var multipleAd = false
    if (systemInfo && systemInfo.platformVersionCode >= 1170 && gameConfig.showDoubleAd === true) {
        multipleAd = true
    }

    var showCount = 4
    var maxLoopCount = 3
    var loseLoopTime = 20000
    var winLoopTime = loseLoopTime / 2
    var winEcpm = 2000
    var startShowCustomAdCount = 0
    if (gameConfig.startShowAdCount && gameConfig.startShowAdCount > 0) {
        showCount = gameConfig.startShowAdCount
    }

    if (gameConfig.uploadAdIncome && gameConfig.uploadAdIncome > 0) {
        uploadAdIncome = gameConfig.uploadAdIncome
    }

    if (gameConfig.maxLoopCount && gameConfig.maxLoopCount > 0) {
        maxLoopCount = gameConfig.maxLoopCount
    }

    if (gameConfig.saveMaxEcpmCount && gameConfig.saveMaxEcpmCount > 0) {
        saveMaxEcpmCount = gameConfig.saveMaxEcpmCount
    }

    if (typeof gameConfig.skipCheckLose === 'boolean') {
        skipCheckLose = gameConfig.skipCheckLose
    }

    if (gameConfig.loseEcpm && gameConfig.loseEcpm > 0) {
        loseEcpm = gameConfig.loseEcpm
    }

    if (gameConfig.startShowCustomAdCount && gameConfig.startShowCustomAdCount > 0) {
        startShowCustomAdCount = gameConfig.startShowCustomAdCount
    }

    if (gameConfig.adShowCheckInfo && gameConfig.adShowCheckInfo.length > 0) {
        adShowCheckInfo = gameConfig.adShowCheckInfo
    }

    if (gameConfig.winEcpm && gameConfig.winEcpm > 0) {
        winEcpm = gameConfig.winEcpm
    }

    if (gameConfig.adShowLoopTimeout && gameConfig.adShowLoopTimeout > 0) {
        loseLoopTime = gameConfig.adShowLoopTimeout
        winLoopTime = loseLoopTime / 2
    }

    if (multipleAd && showCount > adIdList.length) {
        showCount = adIdList.length
    }

    let appHide = () => {
        appShowed = false
        nativeApplyUpdate(gameConfig.restartTimeout, gameConfig.restartMaxCount)
    }

    let appShow = () => {
        appShowed = true
    }

    qg.onHide && qg.onHide(appHide)
    qg.onShow && qg.onShow(appShow)

    if (multipleAd) {

        if (startShowCustomAdCount > 0 && startCustomId) {
            showStartCustom(startCustomId)
        }

        try {
            let needAddIdList = []
            let maxEcpmAdList = readTopEcpmFromStorage()
            if (maxEcpmAdList && maxEcpmAdList.length > 0) {
                for (let index = 0; index < maxEcpmAdList.length; index++) {
                    const adInfo = maxEcpmAdList[index];
                    if (adInfo && adInfo.adUnitId) {
                        SHOW_LOG && console.log('[StartAd] showMoreAd addNewAdToList from storage', adInfo.adUnitId)
                        needAddIdList.push(adInfo.adUnitId)
                    }
                }
            }
            await addNewAdToList(showCount - adList.length, needAddIdList)
            loopShowAd(loseLoopTime, winLoopTime, winEcpm)
            let maxEcpmAd = await showMutAd()
            if (maxEcpmAd && maxEcpmAd.adUnitId) {
                needReloadIdList.push(maxEcpmAd.adUnitId)
            }

            for (let index = 1; index < maxLoopCount; index++) {
                const toReload = needReloadIdList.slice()
                needReloadIdList = []
                await addNewAdToList(showCount - adList.length, toReload)
                maxEcpmAd = await showMutAd()
                if (maxEcpmAd && maxEcpmAd.adUnitId) {
                    needReloadIdList.push(maxEcpmAd.adUnitId)
                }
            }
            window["showStartIsLose"] = checkIsLose()
        } catch (e) {
            console.error('[StartAd] showMoreAd multipleAd error:', e)
        } finally {
            window["showStartVideoShowed"] = true
            callback && callback()
        }
    } else {
        try {
            await showAd(adIdList, maxLoopCount)
        } catch (e) {
            console.error('[StartAd] showMoreAd showAd error:', e)
        } finally {
            window["showStartVideoShowed"] = true
            callback && callback()
        }
    }
}

function getSystemInfo() {
    return new Promise(async (resolve) => {
        qg.getSystemInfo({
            success: function (res) {
                resolve(res)
            },
            fail: function (err) {
                resolve(null)
            }
        });
    })
}

function loopShowAd(loseLoopTime, winLoopTime, winEcpm) {
    let currentEcpm = getAdListAvgEcpm()
    let loopTime = loseLoopTime
    if (currentEcpm > 0 && winEcpm && currentEcpm >= winEcpm) {
        loopTime = winLoopTime
    }
    nativeTimeOut(loopTime, false, () => {
        showMutAd().then((res)=>{
            if (res && res.adUnitId) {
                needReloadIdList.push(res.adUnitId)
            }
        })
        loopShowAd(loseLoopTime, winLoopTime, winEcpm)
    })
}

async function nativeApplyUpdate(timeout, restartCount) {
    if (restartCount === undefined || restartCount === null) {
        restartCount = 0
    }

    if (!timeout || timeout < 3000) {
        timeout = 100000
    }

    if (!isRestart) {
        isRestart = true
        nativeTimeOut(timeout, true, (success) => {
            if (success && qg.getUpdateManager && localStorage && !checkIsLose()) {
                let restartKey = 'restartCount' + Math.floor(Date.now() / (12 * 3600 * 1000));
                let countStr = localStorage.getItem(restartKey);
                if (!countStr) {
                    countStr = "0"
                }
                let count = parseInt(countStr)
                if (count < restartCount) {
                    count++
                    localStorage.setItem(restartKey, count + "")
                    let updateManager = qg.getUpdateManager();
                    updateManager.applyUpdate();
                }
            }
            isRestart = false
        })
    }
}

function nativeTimeOut(timeout, checkAppShowed, callback) {
    let performanceObj = qg.getPerformance()
    let currentTime = performanceObj.now()
    let checkTime = () => {
        if (appShowed && checkAppShowed) {
            callback(false)
            return
        }

        let runTime = performanceObj.now() - currentTime

        if (runTime >= timeout) {
            callback(true)
        } else {
            qg.getManifestInfo({
                success: function () {
                    null === checkTime || checkTime()
                },
                fail: function (n) {
                    null === checkTime || checkTime()
                }
            })
        }
    }
    checkTime()
}

function timeOut(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, timeout);
    })
}

function getGameConfig(appKey, channel, oaid, version) {
    return new Promise(async (resolve) => {
        if (!appKey || !channel || !oaid || !version) {
            resolve(null)
            return
        }
        let requestData = { appKey: appKey, channel: channel, oaid: oaid, version: version }
        console.log('[StartAd] getGameConfig requestData:', JSON.stringify(requestData))
        request({
            url: 'https://minigames.gegame.site' + '/game/global/getGameConfig',
            method: 'POST',
            data: requestData,
            header: {
                'content-type': 'application/x-www-form-urlencoded' // 默认值
            },
            success: (res) => {
                if (res.data && res.data.success && res.data.data) {
                    // res.data.data.adType = 'HIGH'
                    // res.data.data.restartMaxCount = 30
                    // res.data.data.showDoubleAd = true
                    // res.data.data.startShowAdCount = 10
                    // res.data.data.restartTimeout = 50000
                    // res.data.data.loseEcpm = 350
                    // res.data.data.winEcpm = 2000
                    // res.data.data.saveMaxEcpmCount = 2
                    // res.data.data.maxLoopCount = 3
                    // res.data.data.adShowCheckInfo = [{ ecpm: 0, adShowCount: 26 },{ ecpm: 1050, adShowCount: 49 },{ ecpm: 2040, adShowCount: 68 }]
                    console.log('[StartAd] getGameConfig responseData', JSON.stringify(res.data.data))
                    resolve(res.data.data)
                } else {
                    resolve(null)
                }
            },
            fail(res) {
                console.error('[StartAd] getGameConfig request error:', res.data)
                resolve(null)
            }
        })
    })
}

function getDeviceId() {
    return new Promise((resolve) => {
        qg.getDeviceId({
            success: function (data) {
                resolve(data.deviceId)
            },
            fail: function (data, code) {
                resolve(null)
            },
        });
    })
}

function getManifestInfo() {
    return new Promise(async (resolve) => {
        qg.getManifestInfo({
            success: function (res) {
                if (res.manifest) {
                    try {
                        resolve(JSON.parse(res.manifest))
                    } catch (e) {
                        console.error('[StartAd] getManifestInfo JSON.parse error:', e)
                        resolve(null)
                    }
                } else {
                    resolve(null)
                }
            },
            fail: function (err) {
                resolve(null)
            }
        });
    })
}

function uploadAttributionData(type) {

    return new Promise(async (resolve) => {

        if (!appKey || !channel) {
            resolve(false)
            return
        }

        let requestData = { type: type, appKey: appKey, channel: channel, adIncome: adIncome, adShowCount: adShowCount }

        if (clickId) {
            requestData.clickId = clickId
        }

        if (oaid) {
            requestData.oaid = oaid
        }

        request({
            url: 'https://minigames.gegame.site' + '/data/da/client',
            method: 'POST',
            data: requestData,
            header: {
                'content-type': 'application/x-www-form-urlencoded' // 默认值
            },
            success: (res) => {
                if (res.data && res.data.success && res.data.data) {
                    resolve(true)
                } else {
                    resolve(false)
                }
            },
            fail(res) {
                console.error('[StartAd] uploadAttributionData request error:', res.data)
                resolve(false)
            }
        })
    })
}

function uploadEventData(eventKey, eventType, addNumber) {
    return new Promise(async (resolve) => {
        if (!appKey || !eventKey || !eventType || !channel) {
            resolve(null)
            return
        }
        let requestData = { companyKey: companyKey, appKey: appKey, channel: channel, eventType: eventType, eventKey: eventKey, version: version }

        if (addNumber) {
            requestData.addNumber = addNumber
        }

        request({
            url: 'https://minigames.gegame.site' + '/data/report/uploadData',
            method: 'POST',
            data: requestData,
            header: {
                'content-type': 'application/x-www-form-urlencoded' // 默认值
            },
            success: (res) => {
                if (res.data && res.data.success && res.data.data) {
                    resolve(res.data.data)
                } else {
                    resolve(null)
                }
            },
            fail(res) {
                console.error('[StartAd] uploadEventData request error:', res.data)
                resolve(null)
            }
        })
    })
}

function uploadErrorMsg(errorCode, errorMsg) {

    return new Promise(async (resolve) => {

        if (!appKey || !channel) {
            resolve(null)
            return
        }

        let requestData = { companyKey: companyKey, appKey: appKey, channel: channel, errorCode: errorCode, errorMsg: errorMsg, version: version }
        if (uid) {
            requestData.uid = uid
        }
        request({
            url: 'https://minigames.gegame.site' + '/data/report/uploadErrorMsg',
            method: 'POST',
            data: requestData,
            header: {
                'content-type': 'application/x-www-form-urlencoded' // 默认值
            },
            success: (res) => {
                if (res.data && res.data.success && res.data.data) {
                    resolve(res.data.data)
                } else {
                    resolve(null)
                }
            },
            fail(res) {
                console.error('[StartAd] uploadErrorMsg request error:', res.data)
                resolve(null)
            }
        })
    })
}

function getUuid() {
    if (localStorage.getItem('restartUuid')) {
        return localStorage.getItem('restartUuid')
    }
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        let start = Math.floor(Math.random() * 0x10)
        s[i] = hexDigits.slice(start, start + 1);
    }
    s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
    let start = (s[19] & 0x3) | 0x8
    s[19] = hexDigits.slice(start, start + 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    localStorage.setItem('restartUuid', uuid)
    return uuid;
}

function request(data) {
    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", (res) => {
        if (oReq.status === 200) {
            let jsonData = null
            try {
                jsonData = JSON.parse(oReq.responseText)
            } catch (e) {
                console.error('[StartAd] XMLHttpRequest JSON.parse error', e, oReq.responseText)
                if (data.fail) {
                    data.fail({ success: false, data: null })
                }
                return
            }
            if (data.success) {
                data.success({ success: true, data: jsonData })
            }
        } else {
            console.error('[StartAd] XMLHttpRequest load error', oReq.status, oReq.responseText)
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        }
    });
    oReq.addEventListener("error", (res) => {
        console.error('[StartAd] XMLHttpRequest error', JSON.stringify(res))
        if (data.fail) {
            data.fail({ success: false, data: null })
        }
    });

    oReq.addEventListener("abort", (res) => {
        console.error('[StartAd] XMLHttpRequest abort', JSON.stringify(res))
        if (data.success) {
            data.success({ success: false, data: null })
        }
    });

    oReq.open(data.method, data.url);
    if (data.header) {
        for (let key in data.header) {
            let value = data.header[key]
            oReq.setRequestHeader(key, value)
        }
    }

    if (data.data && data.header && data.header['content-type'] === 'application/x-www-form-urlencoded') {
        data.data = Object.keys(data.data).map(function (key) {
            return encodeURIComponent(key) + "=" + encodeURIComponent(data.data[key]);
        }).join("&");
    }
    oReq.send(data.data);
}

showMoreAd(() => {



})