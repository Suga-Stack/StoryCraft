package com.f4.storycraft;

import android.os.Bundle;
import android.webkit.WebView; // 1. 新增导入
import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.facebook.stetho.Stetho;
import com.facebook.stetho.okhttp3.StethoInterceptor;
import okhttp3.OkHttpClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 初始化 Stetho
        Stetho.initializeWithDefaults(this);

        // 配置 OkHttp 拦截器（关键：让 Stetho 捕获网络请求）
        OkHttpClient client = new OkHttpClient.Builder()
                .addNetworkInterceptor(new StethoInterceptor())
                .build();
    }
}