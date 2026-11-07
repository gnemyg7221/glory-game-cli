var getLaunchOptionsSync = function getLaunchOptionsSync() {
    var _globalThis$qg, _globalThis$qg2, _globalThis$qg3, _globalThis$qg3$getEn;
    var startData = (globalThis === null || globalThis === void 0 || (_globalThis$qg = globalThis.qg) === null || _globalThis$qg === void 0 ? void 0 : _globalThis$qg.getLaunchOptionsSync()) || (globalThis === null || globalThis === void 0 || (_globalThis$qg2 = globalThis.qg) === null || _globalThis$qg2 === void 0 ? void 0 : _globalThis$qg2.getNavigateOptionsSync()) || (globalThis === null || globalThis === void 0 || (_globalThis$qg3 = globalThis.qg) === null || _globalThis$qg3 === void 0 || (_globalThis$qg3$getEn = _globalThis$qg3.getEnterOptionsSync) === null || _globalThis$qg3$getEn === void 0 ? void 0 : _globalThis$qg3$getEn.call(_globalThis$qg3));
    return startData;
};

var startData = getLaunchOptionsSync()

let adtest = null
if (startData && startData.query) {
    adtest = startData.query.adtest
}

// adtest = '4425096'

var getAdIdList = function getAdIdList() {
    if (adtest === '4425096') {
        return ['4425096', '4425097', '4425098', '4425099'];
    }
    return null;
};

var adIdList = getAdIdList();
var appShowed = true
var isRestart = false

// 非瀑布流
var showStartVideo = function (adUnitId, callback) {
    platObj = globalThis.qg;
    if (!platObj.createRewardedVideoAd) {
        callback(false)
        return
    }
    var rewardedVideoAd = platObj.createRewardedVideoAd({ adUnitId: adUnitId })
    if (!rewardedVideoAd) {
        callback(false)
        return;
    }
    rewardedVideoAd.onError && rewardedVideoAd.onError(function (res) {
        console.error('rewardedVideoAd onError', res)
        rewardedVideoAd.destroy()
        callback(false)
    })
    rewardedVideoAd.onClose && rewardedVideoAd.onClose(function () {
        rewardedVideoAd.destroy()
        callback(true)
    })

    rewardedVideoAd.onLoad && rewardedVideoAd.onLoad(function () {
        console.log('rewardedVideoAd onLoad')
        if (!rewardedVideoAd.show) {
            callback(false)
            return
        }
        rewardedVideoAd.show()
    })
    rewardedVideoAd.load && rewardedVideoAd.load();
}

function showMoreAd() {
    let appHide = () => {
        appShowed = false
        nativeApplyUpdate()
    }

    let appShow = () => {
        appShowed = true
    }
    if (!adIdList || adIdList.length !== 4) {
        return
    }
    qg.onHide && qg.onHide(appHide)
    qg.onShow && qg.onShow(appShow)

    window["showStartVideoWillShow"] = true
    showStartVideo(adIdList[0], () => {
        showStartVideo(adIdList[1], () => {
            window["showStartVideoShowed"] = true
        })
    })
}

function nativeApplyUpdate(maxCount) {
    if (maxCount === undefined || maxCount === null) {
        maxCount = 10
    }

    if (!isRestart) {
        isRestart = true
        nativeTimeOut(10000, (success) => {
            if (success && qg.getUpdateManager && localStorage) {
                let restartKey = 'restartCount' + Math.floor(Date.now() / (2 * 3600 * 1000));
                let countStr = localStorage.getItem(restartKey);
                if (!countStr) {
                    countStr = "0"
                }
                let count = parseInt(countStr)
                if (count < maxCount) {
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

function nativeTimeOut(timeout, callback) {
    let performanceObj = qg.getPerformance()
    let currentTime = performanceObj.now()
    let checkTime = () => {

        console.log('nativeTimeOut checkTime', appShowed, performanceObj.now() - currentTime, timeout)
        if (appShowed) {
            null === callback || callback(false)
            return
        }
        if (performanceObj.now() - currentTime >= timeout) {
            null === callback || callback(true)
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

showMoreAd()

