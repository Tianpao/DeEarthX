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

// 设置项接口
interface SettingItem {
  key: string;
  name: string;
  description: string;
  path: string;
  defaultValue: boolean;
}

// 设置分类接口
interface SettingCategory {
  id: string;
  title: string;
  icon: string;
  bgColor: string;
  textColor: string;
  items: SettingItem[];
}

// 配置状态
const config = ref<AppConfig>({
  mirror: { bmclapi: false, mcimirror: false },
  filter: { hashes: false, dexpub: false, mixins: false },
  oaf: false
});

// 设置分类和选项数组
const settings: SettingCategory[] = [
  {
    id: 'filter',
    title: '模组筛选设置',
    icon: '🧩',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800',
    items: [
      {
        key: 'hashes',
        name: '哈希过滤',
        description: '过滤不必要的哈希文件',
        path: 'filter.hashes',
        defaultValue: false
      },
      {
        key: 'dexpub',
        name: 'DeP过滤',
        description: '过滤 DeP 相关文件',
        path: 'filter.dexpub',
        defaultValue: false
      },
      {
        key: 'mixins',
        name: 'Mixin过滤',
        description: '过滤 Mixin 文件',
        path: 'filter.mixins',
        defaultValue: false
      }
    ]
  },
  {
    id: 'mirror',
    title: '下载源设置',
    icon: '⬇️',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-800',
    items: [
      {
        key: 'mcimirror',
        name: 'MCIM镜像源',
        description: '使用 MCIM 镜像源加速下载',
        path: 'mirror.mcimirror',
        defaultValue: false
      },
      {
        key: 'bmclapi',
        name: 'BMCLAPI镜像源',
        description: '使用 BMCLAPI 镜像源加速下载',
        path: 'mirror.bmclapi',
        defaultValue: false
      }
    ]
  },
  {
    id: 'system',
    title: '系统管理设置',
    icon: '🛠️',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    items: [
      {
        key: 'oaf',
        name: '操作完成后打开目录',
        description: '服务端制作完成后自动打开目录',
        path: 'oaf',
        defaultValue: false
      }
    ]
  }
];

// 获取配置值
function getConfigValue(path: string): boolean {
  const keys = path.split('.');
  let value = config.value;
  
  for (const key of keys) {
    // @ts-expect-error - 动态访问对象属性
    value = value[key];
  }
  
  // 确保返回值是boolean类型
  if (typeof value === 'boolean') {
    return value;
  }
  
  // 如果类型不是boolean，返回默认值false
  console.warn(`Config value at path "${path}" is not a boolean:`, value);
  return false;
}

// 设置配置值
function setConfigValue(path: string, value: boolean): void {
  const keys = path.split('.');
  let obj = config.value;
  
  // 遍历到倒数第二个key
  for (let i = 0; i < keys.length - 1; i++) {
    // @ts-expect-error - 动态访问对象属性
    obj = obj[keys[i]];
  }
  
  // 设置最后一个key的值
  // @ts-expect-error - 动态访问对象属性
  obj[keys[keys.length - 1]] = value;
}

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
  <div class="tw:h-full tw:w-full tw:p-4 tw:overflow-auto tw:bg-gray-50">
    <div class="tw:max-w-2xl tw:mx-auto">
      <!-- 标题区域 -->
      <div class="tw:text-center tw:mb-8">
        <h1 class="tw:text-4xl tw:font-bold tw:tracking-tight">
          <span class="tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
            DeEarth X
          </span>
          <span class="tw:text-gray-800">设置</span>
        </h1>
        <p class="tw:text-gray-500 tw:mt-2">让你的 DeEarthX V3 更加适合你自己!</p>
      </div>

      <!-- 动态渲染设置卡片 -->
      <div 
        v-for="category in settings" 
        :key="category.id"
        class="tw:bg-white tw:rounded-lg tw:shadow-md tw:p-6 tw:mb-6"
      >
        <h2 class="tw:text-xl tw:font-semibold tw:text-gray-800 tw:mb-4 tw:flex tw:items-center">
          <span :class="[category.bgColor, category.textColor, 'tw:w-8 tw:h-8 tw:rounded-full tw:flex tw:items-center tw:justify-center tw:mr-3']">
            {{ category.icon }}
          </span>
          {{ category.title }}
        </h2>
        <div class="tw:grid tw:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 tw:gap-4">
          <div 
            v-for="item in category.items" 
            :key="item.key"
            class="tw:flex tw:items-center tw:justify-between tw:p-3 tw:border tw:border-gray-100 tw:rounded-md tw:hover:bg-gray-50"
          >
            <div>
              <p class="tw:text-gray-700 tw:font-medium">{{ item.name }}</p>
              <p class="tw:text-xs tw:text-gray-500">{{ item.description }}</p>
            </div>
            <a-switch 
              :checked="getConfigValue(item.path)" 
              @change="setConfigValue(item.path, $event)"
              :checked-children="'开'" 
              :un-checked-children="'关'" 
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>