package com.marrowrite.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final String LAUNCHER = "file:///android_asset/launcher.html";
    private static final Pattern HOST = Pattern.compile("^[A-Za-z0-9.\\-]{1,253}(:[0-9]{1,5})?$");

    private WebView web;
    private GameServer server;
    private SharedPreferences prefs;
    private String serverError = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("marrow", MODE_PRIVATE);

        server = new GameServer(p -> getAssets().open(p), getFilesDir());
        try { server.start(); } catch (Exception e) { serverError = String.valueOf(e.getMessage()); }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b0807"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.addJavascriptInterface(new Bridge(), "MarrowApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame() && !req.getUrl().toString().startsWith("file:")) {
                    String host = req.getUrl().getHost();
                    v.loadUrl(LAUNCHER + "#err=" + android.net.Uri.encode("Couldn't reach " + host + ". Check the address and that you're on the same Wi-Fi."));
                }
            }
        });
        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(LAUNCHER);

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }

    private void handleBack() {
        String url = web.getUrl();
        if (url != null && !url.startsWith(LAUNCHER)) web.loadUrl(LAUNCHER);
        else finish();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { handleBack(); }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    protected void onDestroy() {
        if (isFinishing()) server.stop();
        web.destroy();
        super.onDestroy();
    }

    private static List<String> localAddresses() {
        List<String> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLinkLocalAddress()) out.add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) { }
        return out;
    }

    /** Called from launcher.html. */
    private class Bridge {
        @JavascriptInterface public String myAddresses() {
            StringBuilder b = new StringBuilder();
            for (String ip : localAddresses()) { if (b.length() > 0) b.append('\n'); b.append(ip).append(':').append(GameServer.PORT); }
            return b.toString();
        }
        @JavascriptInterface public String serverError() { return serverError; }
        @JavascriptInterface public String lastJoin() { return prefs.getString("lastJoin", ""); }
        @JavascriptInterface public void play() {
            runOnUiThread(() -> web.loadUrl("http://127.0.0.1:" + GameServer.PORT + "/"));
        }
        @JavascriptInterface public String join(String raw) {
            String a = raw == null ? "" : raw.trim().replaceFirst("^(?i)https?://", "").replaceAll("/+$", "");
            if (!HOST.matcher(a).matches()) return "That doesn't look like an address. It should look like 192.168.1.23:8787.";
            if (!a.contains(":")) a = a + ":" + GameServer.PORT;
            prefs.edit().putString("lastJoin", a).apply();
            final String url = "http://" + a + "/";
            runOnUiThread(() -> web.loadUrl(url));
            return "";
        }
    }
}
