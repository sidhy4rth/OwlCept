package com.owlcept.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipboardManager
import android.content.Intent
import android.content.res.Configuration
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject

/**
 * Hosts the OwlCept Check page (bundled offline from web/dist) and feeds it
 * text from the share sheet, the text-selection menu, the clipboard button
 * and the Quick Settings tile. The app has no INTERNET permission.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private var pageReady = false
    private var pendingText: String? = null
    private var clipboardRequested = false

    private val assets by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true // remembers the chosen language
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            setBackgroundColor(getColor(R.color.page_background))
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)

                // The page never navigates; keep it that way.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

                override fun onPageFinished(view: WebView, url: String) {
                    pageReady = true
                    pendingText?.let { showInPage(it) }
                    pendingText = null
                }
            }
        }

        val checkButton = Button(this).apply {
            text = getString(R.string.check_clipboard)
            isAllCaps = false
            setTextColor(getColor(R.color.on_brand))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(getColor(R.color.brand))
            }
            setPadding(dp(16), dp(12), dp(16), dp(12))
            setOnClickListener { checkClipboard() }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(getColor(R.color.page_background))
            addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            addView(
                checkButton,
                LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    setMargins(dp(16), dp(8), dp(16), dp(12))
                    gravity = Gravity.CENTER_HORIZONTAL
                },
            )
        }
        applySystemBarInsets(root)
        setContentView(root)
        useDarkSystemBarIconsOnLightTheme()

        web.loadUrl("https://appassets.androidplatform.net/assets/web/index.html?app=android")
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT)?.let(::check)
            Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()?.let(::check)
            ACTION_CHECK_CLIPBOARD -> {
                // Android only lets the focused app read the clipboard; wait for focus.
                clipboardRequested = true
                if (hasWindowFocus()) checkClipboard()
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && clipboardRequested) checkClipboard()
    }

    private fun checkClipboard() {
        clipboardRequested = false
        val clipboard = getSystemService(ClipboardManager::class.java)
        val text = clipboard.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(this)?.toString()
        if (text.isNullOrBlank()) {
            Toast.makeText(this, R.string.nothing_copied, Toast.LENGTH_LONG).show()
        } else {
            check(text)
        }
    }

    private fun check(text: String) {
        if (pageReady) showInPage(text) else pendingText = text
    }

    private fun showInPage(text: String) {
        web.evaluateJavascript("window.owlceptCheck(${JSONObject.quote(text)})", null)
    }

    /** targetSdk 35 draws edge to edge; keep content clear of the status and navigation bars. */
    private fun applySystemBarInsets(view: View) {
        view.setOnApplyWindowInsetsListener { v, insets ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            } else {
                @Suppress("DEPRECATION")
                v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
    }

    /** With edge-to-edge the theme's light-status-bar flag is not enough on Android 15; set it directly. */
    private fun useDarkSystemBarIconsOnLightTheme() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        window.insetsController?.setSystemBarsAppearance(if (night) 0 else light, light)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val ACTION_CHECK_CLIPBOARD = "com.owlcept.app.CHECK_CLIPBOARD"
    }
}
