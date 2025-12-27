<script lang="ts" setup>
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';

// 配置接口定义
interface AppConfig {
  mirror: {
    bmclapi: boolean;
    mcimirror: boolean;
  };
  filter: {
    hashes: boolean;
    dexpub: boolean;
    mixins: boolean;
  };
  oaf: boolean; // 操作完成后打开目录
}

// 配置状态
const config = ref<AppConfig>({
  mirror: { bmclapi: false, mcimirror: false },
  filter: { hashes: false, dexpub: false, mixins: false },
  oaf: false
});

// 从后端加载配置
async function loadConfig() {
  try {
    const response = await fetch('http://localhost:37019/config/get', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      config.value = await response.json();
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    message.error('加载配置失败');
  }
}

// 保存配置到后端
async function saveConfig(newConfig: AppConfig) {
  try {
    const response = await fetch('http://localhost:37019/config/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    if (response.ok) {
      message.success('配置已保存');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    message.error('保存配置失败');
  }
}

// 初始化时加载配置
loadConfig();

// 监听配置变化并保存
let isInitialLoad = true;
watch(config, (newValue) => {
  if (isInitialLoad) {
    isInitialLoad = false;
    return;
  }
  saveConfig(newValue);
}, { deep: true });
</script>

<template>
  <div class="tw:h-full tw:w-full">
    <h1 class="tw:text-3xl tw:font-black tw:tracking-tight tw:text-center">
      <span class="tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
        DeEarth X
      </span>
      <span>设置</span>
    </h1>
    <div class="tw:border-t-2 tw:border-gray-400 tw:mt-6 tw:mb-2"></div>
    <!-- DeEarth设置 -->
    <h1 class="tw:text-xl tw:font-black tw:tracking-tight tw:text-center">模组筛选设置</h1>
    <div class="tw:flex">
      <div class="tw:flex tw:ml-5 tw:mt-2">
        <p class="tw:text-gray-600">哈希过滤</p>
        <a-switch class="tw:left-2" v-model:checked="config.filter.hashes" />
      </div>
      <div class="tw:flex tw:ml-5 tw:mt-2">
        <p class="tw:text-gray-600">DeP过滤</p>
        <a-switch class="tw:left-2" v-model:checked="config.filter.dexpub" />
      </div>
      <div class="tw:flex tw:ml-5 tw:mt-2">
        <p class="tw:text-gray-600">Mixin过滤</p>
        <a-switch class="tw:left-2" v-model:checked="config.filter.mixins" />
      </div>
    </div>
    <!-- DeEarth设置 -->
    <div class="tw:border-t-2 tw:border-gray-400 tw:mt-6 tw:mb-2"></div>
    <!-- 下载源设置 -->
    <h1 class="tw:text-xl tw:font-black tw:tracking-tight tw:text-center">下载源设置</h1>
    <div class="tw:flex">
      <div class="tw:flex tw:ml-5 tw:mt-2">
        <p class="tw:text-gray-600">MCIM镜像源</p>
        <a-switch class="tw:left-2" v-model:checked="config.mirror.mcimirror" />
      </div>
    </div>
    <div class="tw:border-t-2 tw:border-gray-400 tw:mt-6 tw:mb-2"></div>
    <!-- DeEarthX管理 -->
         <div class="tw:flex">
      <div class="tw:flex tw:ml-5 tw:mt-2">
        <p class="tw:text-gray-600">完毕后打开目录</p>
        <a-switch class="tw:left-2" v-model:checked="config.oaf" />
      </div>
    </div>
  </div>
</template>