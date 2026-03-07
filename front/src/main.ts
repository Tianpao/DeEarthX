import { createApp } from "vue";
import App from "./App.vue";
import "./tailwind.css"
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import router from "./router";



const app = createApp(App);

// 全局错误处理
app.config.errorHandler = (err, _instance, info) => {
  console.error('Vue组件错误:', err);
  console.error('错误信息:', info);
  // 可以在这里添加错误上报或用户提示
};

// 捕获未处理的Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise错误:', event.reason);
  // 可以在这里添加错误上报或用户提示
  // 清除错误，避免浏览器控制台警告
  if (event.reason) {
    event.preventDefault();
  }
});

// 捕获全局错误
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  // 可以在这里添加错误上报或用户提示
});

app.use(router)
app.use(Antd)
app.mount("#app");
