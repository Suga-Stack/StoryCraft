package com.f4.storycraft;

import android.os.Bundle;
import android.os.Build;
import android.view.Window;
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

        // 3. 底部导航栏隐藏
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.getInsetsController().hide(android.view.WindowInsets.Type.navigationBars());
        } else {
            window.getDecorView().setSystemUiVisibility(
                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }

        // OkHttp配置
        OkHttpClient client = new OkHttpClient.Builder()
                .addNetworkInterceptor(new StethoInterceptor())
                .build();
    }
}