import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./tailwind.css"
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import router from "./utils/router";
import i18n from "./utils/i18n";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia)
app.use(router)
app.use(Antd)
app.use(i18n)
app.mount("#app");
