# Cocolytics Frontend

## Install Flow

The app now supports both install methods from the UI:

- Native Android package download (preferred on Android)
- Browser install prompt (PWA fallback)

### Home Install Button Behavior

When users tap Install:

1. If device is Android and an APK is available, download starts automatically.
2. If no APK is available, app uses browser install prompt when supported.
3. If prompt is unavailable (for example iOS), manual install instructions are shown.

## Native APK Setup

Use either option:

- Place APK at `public/downloads/cocolytics-android.apk`
- Or set `VITE_NATIVE_APP_DOWNLOAD_URL` to a hosted APK URL

Example `.env` entry:

`VITE_NATIVE_APP_DOWNLOAD_URL=https://your-domain.com/releases/cocolytics-android.apk`

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
