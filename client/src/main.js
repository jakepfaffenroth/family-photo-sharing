import { createApp } from 'vue';
import router from './router';
import App from './App.vue';

import './assets/styles/tailwind.css';
import store from './store';
import keepInViewPortDirective from './utils/keepInViewportDirective.js';

const app = createApp(App).use(store);

app.directive('keepInViewport', keepInViewPortDirective);

app.use(router);

app.mount('#app');
