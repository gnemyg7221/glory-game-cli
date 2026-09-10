// glory-game-managed:v1
package com.cocos.game;

import android.content.Context;

import androidx.multidex.MultiDex;
import androidx.multidex.MultiDexApplication;

import com.example.cli.fixture.BuildConfig;
import com.glory.adsdk.AdSdk;
import com.glory.adsdk.AdSdkConfig;

public class MyApplication extends MultiDexApplication {

    @Override
    public void onCreate() {
        super.onCreate();

        AdSdkConfig config = new AdSdkConfig();
        config.appKey = BuildConfig.APPLICATION_ID;
        config.versionName = BuildConfig.VERSION_NAME;
        config.adProviderAppId = "fixture-provider";
        config.mainGameActivityClass = AppActivity.class;
        config.debug = BuildConfig.DEBUG;
        config.gameCenterAppSecret = BuildConfig.GLORY_GAME_CENTER_APP_SECRET;
        config.skipPrivacyBeforeTime = "2026-01-01 00:00:00";

        AdSdkConfig.PrivacyConfig privacyConfig = new AdSdkConfig.PrivacyConfig();
        privacyConfig.privacyPolicyUrl = "https://test.example.com/privacy";
        config.privacyConfig = privacyConfig;
        AdSdk.init(this, config);
    }

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);
    }
}
