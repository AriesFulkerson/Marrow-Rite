# Marrow Rite for Android

The Marrow Rite game, unchanged (the same `host/public/index.html` from this repo), in an Android app.
The app has the 1v1 match server built in, so one phone hosts and friends join it from their phones
over the same Wi-Fi. No PC needed.

## Install

Download `MarrowRite.apk` from the project site or the repo's Releases page, copy it to each phone (or send it over Drive, Discord or similar), open it, and allow
"Install unknown apps" when Android asks. Needs Android 8.0 or newer.

## Play a friend

1. **Host:** open the app. It shows your address, e.g. `192.168.1.23:8787`. Tap **Enter the Rite**, then
   **1v1**, pick a deck and tap **Create match**. You get a four-letter code.
2. **Friend:** open the app, type the host's address under **Join a friend**, and tap **Join**. Tap **1v1**,
   type the code and tap **Join**.
3. Keep the host's app open during the match. The back button returns to the start screen.

Friends without the app can join from any browser at `http://<host address>`, and the app can also join
the Windows PC host (`marrow-rite-host.zip`) by typing the PC's address.
Vs AI, packs, collection and deck building work on the start screen's **Enter the Rite**.

## Build

Open this folder in Android Studio, or run `gradlew assembleDebug` (with `JAVA_HOME` set to Android
Studio's `jbr`). The APK lands in `app/build/outputs/apk/debug/`.
`gradlew testDebugUnitTest` runs tests against the built-in server's API.

## Files

| Path | What it is |
|---|---|
| `app/src/main/assets/game/` | The game and its art, copied from the repo's `host/public/` |
| `app/src/main/assets/launcher.html` | The start screen (host address, join a friend) |
| `app/src/main/java/.../GameServer.java` | The match server, ported from `host/server.ps1` (same API) |
| `app/src/main/java/.../MainActivity.java` | The app window (WebView) |
| `app/src/test/.../GameServerTest.java` | Server API tests |
