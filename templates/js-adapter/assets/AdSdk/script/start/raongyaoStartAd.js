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

if (startData && startData.query) {
    adtest = startData.query.adtest
    channel = startData.query.channel
}

// channel = 'aag0n7oo5u'
// adtest = 'aag0n7oo5u'
var adIdList = []

// 非瀑布流
var showStartVideo = function (adUnitId, index) {
    uploadEventData('ad_request_Rewarded', 'frequency')
    return new Promise((resolve) => {
        platObj = globalThis.qg;
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
            rewardedVideoAd.show()

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
    let errorCount = 0
    for (let index = 0; index < adCount; index++) {
        const adId = adIdList[index % adIdList.length];
        let success = await showStartVideo(adId, index)
        if (!success) {
            errorCount++
            if (errorCount >= 1) {
                break
            }
            await timeOut(200)
        }
    }
}
async function showMoreAd() {

    if (adtest !== 'aag0n7oo5u') {
        return
    }

    uploadEventData('app_start', 'frequency')
    window["startJsRun"] = true

    let manifestInfo = await getManifestInfo()
    if (manifestInfo && manifestInfo.versionName) {
        version = manifestInfo.versionName
    }
    if (manifestInfo && manifestInfo.package) {
        appKey = manifestInfo.package
    }

    window["showStartVideoWillShow"] = true
    var oaid = await getDeviceId()
    var gameConfig = await getGameConfig(appKey, channel, oaid, version)
    window["startGameConfig"] = gameConfig
    if (!gameConfig || gameConfig.adType !== 'HIGH') {
        window["showStartVideoShowed"] = true
        return
    }

    for (let key in gameConfig.adUnitIdEcpmInfo) {
        if (gameConfig.adUnitIdEcpmInfo.hasOwnProperty(key)) {
            let value = gameConfig.adUnitIdEcpmInfo[key]
            if (value.type === "Rewarded" && value.adId) {
                adIdList.push(value.adId)
            }
        }
    }

    if (!adIdList || adIdList.length === 0) {
        window["showStartVideoShowed"] = true
        return
    }

    var showCount = 4
    if (gameConfig.startShowAdCount && gameConfig.startShowAdCount > 0) {
        showCount = gameConfig.startShowAdCount
    }

    await showAd(adIdList, showCount)
    window["showStartVideoShowed"] = true
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
            },
            complete: function (res) {
                resolve(null)
            },
        });
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
