import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './styles/global.css';
import './styles/notes.css';

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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error) => console.error('service worker', error));
  });
}
