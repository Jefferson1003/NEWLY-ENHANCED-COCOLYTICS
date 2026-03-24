import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'
import './style.css'

document.title = 'Cocolytics'

function applyTabIcons() {
	const links = [
		{
			rel: 'icon',
			type: 'image/png',
			sizes: '192x192',
			href: '/icons/pwa-192x192.png',
		},
		{
			rel: 'icon',
			type: 'image/png',
			sizes: '512x512',
			href: '/icons/pwa-512x512.png',
		},
		{
			rel: 'apple-touch-icon',
			sizes: '180x180',
			href: '/icons/apple-touch-icon.png',
		},
	]

	links.forEach((entry) => {
		const selector = `link[rel="${entry.rel}"]${entry.sizes ? `[sizes="${entry.sizes}"]` : ''}`
		const existing = document.head.querySelector(selector)
		const element = existing || document.createElement('link')

		element.setAttribute('rel', entry.rel)
		if (entry.type) element.setAttribute('type', entry.type)
		if (entry.sizes) element.setAttribute('sizes', entry.sizes)
		element.setAttribute('href', entry.href)

		if (!existing) {
			document.head.appendChild(element)
		}
	})
}

async function clearDevServiceWorkers() {
	if (!('serviceWorker' in navigator)) return

	const registrations = await navigator.serviceWorker.getRegistrations()
	await Promise.all(registrations.map((registration) => registration.unregister()))

	if ('caches' in window) {
		const cacheKeys = await caches.keys()
		await Promise.all(cacheKeys.map((key) => caches.delete(key)))
	}
}

applyTabIcons()

if (import.meta.env.DEV) {
	clearDevServiceWorkers().catch(() => {})
} else {
	registerSW({ immediate: true })
}

createApp(App).use(router).mount('#app')
