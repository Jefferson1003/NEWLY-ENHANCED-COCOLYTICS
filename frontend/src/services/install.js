import { ref } from 'vue'

const deferredPrompt = ref(null)
const installReady = ref(false)
const isInstalled = ref(false)

let listenersAttached = false
let androidPackageReachable = null

function resolveNativeDownloadUrl() {
  const envUrl = (import.meta.env.VITE_NATIVE_APP_DOWNLOAD_URL || '').trim()
  if (envUrl) return envUrl
  return '/downloads/cocolytics-android.apk'
}

const nativeDownloadUrl = resolveNativeDownloadUrl()

function detectInstalledState() {
  const standaloneMode = window.matchMedia?.('(display-mode: standalone)')?.matches
  const fullscreenMode = window.matchMedia?.('(display-mode: fullscreen)')?.matches
  const minimalUiMode = window.matchMedia?.('(display-mode: minimal-ui)')?.matches
  return Boolean(standaloneMode || fullscreenMode || minimalUiMode || window.navigator.standalone)
}

function isIOS() {
  const userAgent = window.navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(userAgent)
}

function isAndroid() {
  const userAgent = window.navigator.userAgent || ''
  return /Android/i.test(userAgent)
}

function isNgrokHost() {
  const host = window.location.hostname || ''
  return host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok.app')
}

async function checkAndroidPackageAvailable() {
  if (androidPackageReachable !== null) return androidPackageReachable

  if (!nativeDownloadUrl) {
    androidPackageReachable = false
    return androidPackageReachable
  }

  try {
    const response = await fetch(nativeDownloadUrl, {
      method: 'HEAD',
      cache: 'no-store',
    })

    androidPackageReachable = response.ok
  } catch {
    androidPackageReachable = false
  }

  return androidPackageReachable
}

function triggerDownload(url) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ''
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function onBeforeInstallPrompt(event) {
  event.preventDefault()
  deferredPrompt.value = event
  installReady.value = true
}

function onAppInstalled() {
  isInstalled.value = true
  installReady.value = false
  deferredPrompt.value = null
}

export function initializeInstallManager() {
  if (typeof window === 'undefined' || listenersAttached) return

  listenersAttached = true
  isInstalled.value = detectInstalledState()

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)

  const mediaQuery = window.matchMedia?.('(display-mode: standalone)')
  mediaQuery?.addEventListener?.('change', () => {
    isInstalled.value = detectInstalledState()
  })
}

export function getInstallState() {
  return {
    installReady,
    isInstalled,
    nativeDownloadUrl,
  }
}

export async function requestInstall() {
  if (isInstalled.value) {
    return {
      status: 'installed',
      message: 'Cocolytics is already installed on this device.',
    }
  }

  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const choiceResult = await deferredPrompt.value.userChoice

    deferredPrompt.value = null
    installReady.value = false

    return {
      status: choiceResult.outcome === 'accepted' ? 'accepted' : 'dismissed',
      message:
        choiceResult.outcome === 'accepted'
          ? 'Install accepted. Cocolytics will stay on your device like a regular app.'
          : 'Install dismissed. You can trigger it again later.',
    }
  }

  // Fall back to native package only when browser PWA prompt is unavailable.
  if (isAndroid()) {
    const hasNativePackage = await checkAndroidPackageAvailable()
    if (hasNativePackage) {
      triggerDownload(nativeDownloadUrl)
      return {
        status: 'native-download',
        message: 'PWA install prompt unavailable. Android app package download started instead.',
      }
    }
  }

  return {
    status: 'manual',
    message: isIOS()
      ? 'On iPhone: tap Share, then choose Add to Home Screen.'
      : isNgrokHost()
        ? 'Install is not ready on this ngrok link yet. Open the same link directly in your phone browser, pass the ngrok warning page once (Visit Site), refresh, then tap Install again or use browser menu > Install app.'
        : 'Install is unavailable right now. Open this app from HTTPS (or localhost), then refresh and try again. If needed, use browser menu > Install app.',
  }
}
