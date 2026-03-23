import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import Home from './Home.vue'

registerSW({ immediate: true })

createApp(Home).mount('#app')
