package com.f4.storycraft;

import android.os.Bundle;
import android.os.Build;
import android.view.Window;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.facebook.stetho.Stetho;
import com.facebook.stetho.okhttp3.StethoInterceptor;
import okhttp3.OkHttpClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme_NoActionBar);
        super.onCreate(savedInstanceState);

        Stetho.initializeWithDefaults(this);

        Window window = getWindow();
        // 1. 状态栏占空间 + 移除根视图内边距
        WindowCompat.setDecorFitsSystemWindows(window, true); 
        ViewGroup rootView = (ViewGroup) window.getDecorView().findViewById(android.R.id.content);
        if (rootView != null) {
            rootView.setPadding(0, 0, 0, 0);
        }

        // 2. 状态栏样式（固定）
        window.setStatusBarColor(getResources().getColor(R.color.statusBarFinal)); 
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
            controller.show(androidx.core.view.WindowInsetsCompat.Type.statusBars());
        }

        // OkHttp配置
        OkHttpClient client = new OkHttpClient.Builder()
                .addNetworkInterceptor(new StethoInterceptor())
                .build();
    }

    // 新增：当页面获取焦点时隐藏导航栏（关键修改）
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) { // 只有在页面获得焦点时才执行隐藏
            hideNavigationBar();
        }
    }

    // 封装导航栏隐藏逻辑
    private void hideNavigationBar() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11及以上版本
            window.getInsetsController().hide(android.view.WindowInsets.Type.navigationBars());
            // 设置导航栏行为为沉浸式（用户交互后自动隐藏）
            window.getInsetsController().setSystemBarsBehavior(
                android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        } else {
            // Android 10及以下版本
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION    // 隐藏导航栏
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY // 沉浸式粘性模式（用户交互后自动隐藏）
                | View.SYSTEM_UI_FLAG_FULLSCREEN       // 可选：同时隐藏状态栏（如果需要）
            );
        }
    }
}