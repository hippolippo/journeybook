import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './styles/global.css';

// Lock the app viewport: block pinch-zoom and two-finger gestures on touch.
for (const type of ['gesturestart', 'gesturechange', 'gestureend'] as const) {
  document.addEventListener(type, (event) => event.preventDefault());
}
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.touches.length > 1) event.preventDefault();
  },
  { passive: false },
);

createApp(App).use(createPinia()).use(router).mount('#app');
