const SHOW_LOG = false

var getLaunchOptionsSync = function getLaunchOptionsSync() {
    var _globalThis$qg, _globalThis$qg2, _globalThis$qg3, _globalThis$qg3$getEn;
    var startData = (globalThis === null || globalThis === void 0 || (_globalThis$qg = globalThis.qg) === null || _globalThis$qg === void 0 ? void 0 : _globalThis$qg.getLaunchOptionsSync()) || (globalThis === null || globalThis === void 0 || (_globalThis$qg2 = globalThis.qg) === null || _globalThis$qg2 === void 0 ? void 0 : _globalThis$qg2.getNavigateOptionsSync()) || (globalThis === null || globalThis === void 0 || (_globalThis$qg3 = globalThis.qg) === null || _globalThis$qg3 === void 0 || (_globalThis$qg3$getEn = _globalThis$qg3.getEnterOptionsSync) === null || _globalThis$qg3$getEn === void 0 ? void 0 : _globalThis$qg3$getEn.call(_globalThis$qg3));
    return startData;
};

var startData = getLaunchOptionsSync()

let adtest = null
let channel = null
let version = '1.0.0'
let appKey = 'com.null.nearme.gamecenter'
let companyKey = 'GRJH'
let uid = getUuid()
let adIndex = 0
let adList = []
let isRestart = false
var appShowed = true
var actionCompleteInfo = {}

if (startData && startData.query) {
    adtest = startData.query.adtest
    channel = startData.query.channel
}

// channel = 'aag0n7oo5u'
// adtest = 'wh16bmns96'

var adIdList = [];

// 瀑布流
var loadStartVideo = function (adUnitId) {
    return new Promise((resolve) => {
        let platObj = globalThis.qg;
        if (!platObj.createRewardedVideoAd) {
            resolve(null)
            return
        }
        var rewardedVideoAd = platObj.createRewardedVideoAd({ adUnitId: adUnitId })
        if (!rewardedVideoAd) {
            resolve(null)
            return;
        }
        rewardedVideoAd.onError && rewardedVideoAd.onError(function (res) {
            let errMsg = res.errMsg
            let errCode = res.errCode
            uploadEventData('ad_load_error_Rewarded', 'frequency')
            uploadErrorMsg(errCode, errMsg + `[类型: 激励  adUnitId: ${adUnitId}]`)
            rewardedVideoAd.destroy()
            resolve(null)
        })

        rewardedVideoAd.onLoad && rewardedVideoAd.onLoad(function (data) {
            let ecpm = 1000
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
var addNewAdToList = async (addCount) => {
    SHOW_LOG && console.log('[RewardedVideoWaterfall] initWaterfall call addCount', addCount)
    let loadPromiseList = []
    for (let index = 0; index < addCount; index++) {
        const adId = adIdList[adIndex % adIdList.length];
        adIndex++
        SHOW_LOG && console.log('[RewardedVideoWaterfall] initWaterfall adKey addToList', adIndex, adId)
        loadPromiseList.push(loadStartVideo(adId))
    }
    if (loadPromiseList.length === 0) {
        return
    }
    SHOW_LOG && console.log('[RewardedVideoWaterfall] initWaterfall 开始加载', loadPromiseList.length)
    let loadResultList = await Promise.all(loadPromiseList)
    SHOW_LOG && console.log('[RewardedVideoWaterfall] initWaterfall 加载完成', loadResultList)

    if (loadResultList.length === 0) {
        return
    }
    for (let index = 0; index < loadResultList.length; index++) {
        const adResult = loadResultList[index];
        if (!adResult) {
            continue
        }
        SHOW_LOG && console.log('[RewardedVideoWaterfall] initWaterfall 加载完成 adResult', adResult.ecpm, adResult.adUnitId)
        if (adResult && adResult.ecpm > 0 && adResult.adObj) {
            adList.push(adResult)
        }
    }
}
var showMutAd = async () => {
    if (!adList || adList.length === 0) {
        return null
    }
    uploadEventData('ad_request_Rewarded', 'frequency')
    adList = adList.sort((a, b) => b.ecpm - a.ecpm);
    SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow dList.sort!', adList.map((a) => { return { ecpm: a.ecpm, id: a.adUnitId } }))
    let maxEcpmAd = adList.shift()
    SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow maxEcpmAd!', maxEcpmAd.ecpm)
    let showResult = await maxEcpmAd.adObj.show()
    SHOW_LOG && console.log('[RewardedVideoWaterfall] asyncShow showResult!', showResult)
    if (showResult && showResult.code === 0) {
        uploadEventData('ad_show_Rewarded', 'frequency')
        uploadEventData('ad_incom_Rewarded', 'number', maxEcpmAd.ecpm)
        if (!window["showStartVideoEcpmNum"]) {
            window["showStartVideoEcpmNum"] = 0
        }
        window["showStartVideoEcpmNum"] = window["showStartVideoEcpmNum"] + maxEcpmAd.ecpm
    }
    return showResult
}
// 非瀑布流
var showStartVideo = function (adUnitId, index) {
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
            uploadErrorMsg(errCode, errMsg + `[类型: 激励  adUnitId: ${adUnitId} index:${index} version: ${version}]`)

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

            let ecpm = 1000
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

        })
        rewardedVideoAd.load && rewardedVideoAd.load();
    })
}
var showAd = async function (adIdList, adCount) {
    for (let index = 0; index < adCount; index++) {
        const adId = adIdList[index % adIdList.length];
        let success = await showStartVideo(adId, index)
        if (!success) {
            await timeOut(200)
        }
    }
}

async function showMoreAd() {

    if (adtest !== 'wh16bmns96') {
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
    var oaid = await getDeviceId()
    var gameConfig = await getGameConfig(appKey, channel, oaid, version)
    window["startGameConfig"] = gameConfig
    if (!gameConfig || gameConfig.adType !== 'HIGH') {
        window["showStartVideoShowed"] = true
        return
    }

    if (gameConfig.adUnitIdEcpmInfo && Object.keys(gameConfig.adUnitIdEcpmInfo).length > 0) {
        for (let key in gameConfig.adUnitIdEcpmInfo) {
            if (gameConfig.adUnitIdEcpmInfo.hasOwnProperty(key)) {
                let value = gameConfig.adUnitIdEcpmInfo[key]
                if (value.type === "Rewarded" && value.adId) {
                    adIdList.push(value.adId)
                }
            }
        }
    }

    if (!adIdList || adIdList.length === 0) {
        window["showStartVideoShowed"] = true
        return
    }

    var systemInfo = await getSystemInfo()
    var multipleAd = false
    if (systemInfo && systemInfo.platformVersionCode >= 1170 && gameConfig.showDoubleAd === true) {
        multipleAd = true
    }

    var showCount = 4
    var useUpdateRestart = true
    if (gameConfig.startShowAdCount && gameConfig.startShowAdCount > 0) {
        showCount = gameConfig.startShowAdCount
    }

    if (gameConfig.useUpdateRestart === false) {
        useUpdateRestart = false
    }

    if (multipleAd && showCount > adIdList.length) {
        showCount = adIdList.length
    }

    let callCount = 0
    if (multipleAd) {
        callCount = showCount
    }

    let appHide = () => {
        appShowed = false
        nativeApplyUpdate(gameConfig.restartTimeout, gameConfig.restartMaxCount, callCount, useUpdateRestart ,() => {
            if (multipleAd) {
                showMutAd()
            }
        })
    }

    let appShow = () => {
        appShowed = true
    }

    qg.onHide && qg.onHide(appHide)
    qg.onShow && qg.onShow(appShow)

    if (multipleAd) {
        await addNewAdToList(showCount)
        await showMutAd()
        for (let index = 0; index < showCount - 1; index++) {
            await showMutAd()
        }
    } else {
        await showAd(adIdList, showCount)
    }
    window["showStartVideoShowed"] = true
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

function nativeApplyUpdate(timeout, restartCount, callCount, useUpdateRestart , actionCallback) {
    if (restartCount === undefined || restartCount === null) {
        restartCount = 0
    }

    if (!timeout || timeout < 3000) {
        timeout = 14000
    }

    if (!isRestart) {
        isRestart = true
        nativeTimeOut(timeout, callCount, (success) => {
            if (success && qg.getUpdateManager && localStorage) {
                let restartKey = 'restartCount' + Math.floor(Date.now() / (2 * 3600 * 1000));
                let countStr = localStorage.getItem(restartKey);
                if (!countStr) {
                    countStr = "0"
                }
                let count = parseInt(countStr)
                if (count < restartCount) {
                    count++
                    localStorage.setItem(restartKey, count + "")
                    if (useUpdateRestart === true) {
                        let updateManager = qg.getUpdateManager();
                        updateManager.applyUpdate();
                    }
                }
            }
            isRestart = false
        }, (count) => {
            console.log('nativeApplyUpdate actionCallback count', count)
            actionCallback()
        })
    }
}

function nativeTimeOut(timeout, callCount, callback, actionCallback) {
    let performanceObj = qg.getPerformance()
    let currentTime = performanceObj.now()
    let checkTime = () => {
        if (appShowed) {
            null === callback || callback(false)
            return
        }
        let runTime = performanceObj.now() - currentTime

        if (runTime >= (timeout * (callCount + 1))) {
            null === callback || callback(true)
        } else {
            for (let index = callCount; index > 0; index--) {
                if (runTime >= (timeout * index)) {
                    if (!actionCompleteInfo[index]) {
                        null === actionCallback || actionCallback(index)
                        actionCompleteInfo[index] = true
                    }
                    break
                }
            }
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
        console.log('getGameConfig requestData:', JSON.stringify(requestData))
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
                    // res.data.data.restartMaxCount = 50
                    // res.data.data.showDoubleAd = true
                    // res.data.data.startShowAdCount = 2
                    // res.data.data.restartTimeout = 5000
                    // res.data.data.useUpdateRestart = false
                    console.log('getGameConfig responseData', JSON.stringify(res.data.data))
                    resolve(res.data.data)
                } else {
                    resolve(null)
                }
            },
            fail(res) {
                console.error('getGameConfig request error:', res.data)
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
                    resolve(JSON.parse(res.manifest))
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
                console.error('uploadEventData request error:', res.data)
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
                console.error('uploadErrorMsg request error:', res.data)
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
            let jsonData = JSON.parse(oReq.responseText)
            if (data.success) {
                data.success({ success: true, data: jsonData })
            }
        } else {
            console.error('[XMLHttpRequest] load error', oReq.status, oReq.responseText)
            if (data.fail) {
                data.fail({ success: false, data: null })
            }
        }
    });
    oReq.addEventListener("error", (res) => {
        console.error('[XMLHttpRequest] error', JSON.stringify(res))
        if (data.fail) {
            data.fail({ success: false, data: null })
        }
    });

    oReq.addEventListener("abort", (res) => {
        console.error('[XMLHttpRequest] abort', JSON.stringify(res))
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

showMoreAd()
