<script lang="ts" setup>
import { ref, watch, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { setLanguage, type Language } from '../i18n/vue-i18n';

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
    modrinth: boolean;
  };
  oaf: boolean; // 操作完成后打开目录
  autoZip: boolean; // 自动打包成zip
  javaPath?: string; // Java路径
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
  hasJava?: boolean; // 是否包含Java配置
  hasLanguage?: boolean; // 是否包含语言配置
}

// Java版本信息接口
// interface JavaVersion {
//   major: number;
//   minor: number;
//   patch: number;
//   fullVersion: string;
//   vendor: string;
//   runtimeVersion?: string;
// }
//
// // Java检测结果接口
// interface JavaCheckResult {
//   exists: boolean;
//   version?: JavaVersion;
//   error?: string;
// }

// 配置状态
const config = ref<AppConfig>({
  mirror: { bmclapi: false, mcimirror: false },
  filter: { hashes: false, dexpub: false, mixins: false, modrinth: false },
  oaf: false,
  autoZip: false,
  javaPath: undefined
});

// Java相关状态
// const javaPaths = ref<string[]>([]);
// const javaCheckResult = ref<JavaCheckResult | null>(null);
// const javaChecking = ref(false);
// const javaDetecting = ref(false);

// 设置分类和选项数组（使用computed以便响应式更新）
const settings = computed<SettingCategory[]>(() => {
  return [
    {
      id: 'filter',
      title: t('setting.category_filter'),
      icon: '🧩',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-800',
      items: [
        {
          key: 'hashes',
          name: t('setting.filter_hashes_name'),
          description: t('setting.filter_hashes_desc'),
          path: 'filter.hashes',
          defaultValue: false
        },
        {
          key: 'dexpub',
          name: t('setting.filter_dexpub_name'),
          description: t('setting.filter_dexpub_desc'),
          path: 'filter.dexpub',
          defaultValue: false
        },
        {
          key: 'modrinth',
          name: t('setting.filter_modrinth_name'),
          description: t('setting.filter_modrinth_desc'),
          path: 'filter.modrinth',
          defaultValue: false
        },
        {
          key: 'mixins',
          name: t('setting.filter_mixins_name'),
          description: t('setting.filter_mixins_desc'),
          path: 'filter.mixins',
          defaultValue: false
        }
      ]
    },
    {
      id: 'mirror',
      title: t('setting.category_mirror'),
      icon: '⬇️',
      bgColor: 'bg-cyan-100',
      textColor: 'text-cyan-800',
      items: [
        {
          key: 'mcimirror',
          name: t('setting.mirror_mcimirror_name'),
          description: t('setting.mirror_mcimirror_desc'),
          path: 'mirror.mcimirror',
          defaultValue: false
        },
        {
          key: 'bmclapi',
          name: t('setting.mirror_bmclapi_name'),
          description: t('setting.mirror_bmclapi_desc'),
          path: 'mirror.bmclapi',
          defaultValue: false
        }
      ]
    },
    {
      id: 'system',
      title: t('setting.category_system'),
      icon: '🛠️',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-800',
      hasLanguage: true,
      items: [
        {
          key: 'oaf',
          name: t('setting.system_oaf_name'),
          description: t('setting.system_oaf_desc'),
          path: 'oaf',
          defaultValue: false
        },
        {
          key: 'autoZip',
          name: t('setting.system_autozip_name'),
          description: t('setting.system_autozip_desc'),
          path: 'autoZip',
          defaultValue: false
        }
      ]
    }
  ];
});

// 语言选项（使用computed以响应翻译变化）
const languageOptions = computed(() => {
  return [
    { label: '简体中文', value: 'zh_cn' },
    { label: 'English', value: 'en_us' },
    { label: '日本語', value: 'ja_jp' },
    { label: 'Français', value: 'fr_fr' },
    { label: 'Deutsch', value: 'de_de' },
    { label: 'Español', value: 'es_es' }
  ];
});

// 切换语言
function handleLanguageChange(value: Language) {
  setLanguage(value);
}

// i18n
const { t, locale } = useI18n();

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
      console.log('[Setting] 配置已从后端刷新');
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    message.error(t('setting.config_load_failed'));
  }
}

// 暴露刷新配置的方法给外部调用
defineExpose({
  refreshConfig: loadConfig
});

// 保存配置到后端
async function saveConfig(newConfig: AppConfig) {
  try {
    const response = await fetch('http://localhost:37019/config/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    if (response.ok) {
      message.success(t('setting.config_saved'));
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    message.error(t('setting.config_save_failed'));
  }
}

// 导出配置
async function exportConfig() {
  try {
    const configJson = JSON.stringify(config.value, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deearthx_config_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success(t('setting.config_exported'));
  } catch (error) {
    console.error('导出配置失败:', error);
    message.error(t('setting.config_export_failed'));
  }
}

// 导入配置
function importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedConfig = JSON.parse(text) as AppConfig;
      
      // 验证配置格式
      if (!importedConfig.mirror || !importedConfig.filter || 
          typeof importedConfig.oaf !== 'boolean' || 
          typeof importedConfig.autoZip !== 'boolean') {
        message.error(t('setting.config_invalid_format'));
        return;
      }

      // 应用导入的配置
      config.value = importedConfig;
      await saveConfig(importedConfig);
      message.success(t('setting.config_imported'));
    } catch (error) {
      console.error('导入配置失败:', error);
      message.error(t('setting.config_import_failed'));
    }
  };
  input.click();
}

// 检测Java路径
// async function detectJavaPaths() {
//   javaDetecting.value = true;
//   try {
//     const response = await fetch('http://localhost:37019/java/detect');
//     if (response.ok) {
//       const result = await response.json();
//       javaPaths.value = result.data || [];
//       if (javaPaths.value.length === 0) {
//         message.warning('未检测到Java安装');
//       } else {
//         message.success(`检测到 ${javaPaths.value.length} 个Java安装`);
//       }
//     } else {
//       message.error('检测Java路径失败');
//     }
//   } catch (error) {
//     console.error('检测Java路径失败:', error);
//     message.error('检测Java路径失败');
//   } finally {
//     javaDetecting.value = false;
//   }
// }

// 检查Java版本
// async function checkJavaVersion(javaPath?: string) {
//   javaChecking.value = true;
//   javaCheckResult.value = null;
//   try {
//     const url = javaPath
//       ? `http://localhost:37019/java/check?path=${encodeURIComponent(javaPath)}`
//       : 'http://localhost:37019/java/check';
//
//     const response = await fetch(url);
//     if (response.ok) {
//       const result = await response.json();
//       javaCheckResult.value = result.data;
//
//       if (result.data.exists && result.data.version) {
//         message.success(`检测到 Java ${result.data.version.fullVersion}`);
//       } else {
//         message.error(result.data.error || 'Java检查失败');
//       }
//     } else {
//       message.error('Java检查失败');
//     }
//   } catch (error) {
//     console.error('Java检查失败:', error);
//     message.error('Java检查失败');
//   } finally {
//     javaChecking.value = false;
//   }
// }

// 选择Java路径
// function selectJavaPath(path: string) {
//   config.value.javaPath = path;
//   checkJavaVersion(path);
// }

onMounted(() => {
  loadConfig();
});

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
  <div class="tw:h-full tw:w-full tw:p-8 tw:overflow-auto tw:bg-gradient-to-br tw:from-slate-50 tw:via-blue-50 tw:to-indigo-50">
    <div class="tw:max-w-3xl tw:mx-auto">
      <!-- 标题区域 -->
      <div class="tw:text-center tw:mb-10 tw:animate-fade-in">
        <h1 class="tw:text-4xl tw:font-bold tw:tracking-tight tw:mb-3">
          <span class="tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
            {{ t('common.app_name') }}
          </span>
          <span class="tw:text-gray-800">{{ t('menu.setting') }}</span>
        </h1>
        <p class="tw:text-gray-500 tw:text-lg">{{ t('setting.subtitle') }}</p>
        
        <!-- 配置导入导出按钮 -->
        <div class="tw:flex tw:justify-center tw:gap-4 tw:mt-6">
          <a-button 
            type="primary" 
            :icon="DownloadOutlined" 
            @click="exportConfig"
            class="tw:tw-flex tw:items-center tw:gap-2"
          >
            {{ t('setting.export_config') }}
          </a-button>
          <a-button 
            :icon="UploadOutlined" 
            @click="importConfig"
            class="tw:tw-flex tw:items-center tw:gap-2"
          >
            {{ t('setting.import_config') }}
          </a-button>
        </div>
      </div>

      <!-- 动态渲染设置卡片 -->
      <div
        v-for="(category, index) in settings"
        :key="category.id"
        class="tw-bg-white tw:rounded-2xl tw:shadow-lg tw:p-7 tw:mb-6 tw:animate-fade-in-up tw:group tw:border tw:border-gray-100 tw:hover:tw:border-emerald-200 tw:transition-all duration-300"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <h2 class="tw:text-xl tw:font-bold tw:text-gray-800 tw-mb-6 tw:flex tw-items-center tw:group-hover:tw:translate-x-2 tw:transition-transform duration-300">
          <span :class="[category.bgColor, category.textColor, 'tw-w-10 tw:h-10 tw:rounded-xl tw:flex tw:items-center tw:justify-center tw-mr-3 tw:shadow-md']">
            {{ category.icon }}
          </span>
          {{ category.title }}
        </h2>

        <div class="tw:grid tw:grid-cols-1 md:tw:grid-cols-2 lg:tw:grid-cols-3 tw:gap-4">
          <!-- 语言选择器 (仅系统管理设置显示) -->
          <div
            v-if="category.hasLanguage"
            class="tw:flex tw:flex-col tw-justify-between tw-p-4 tw:border tw:border-gray-100 tw:rounded-xl tw-hover:bg-gradient-to-r tw:hover:from-emerald-50 tw:hover:to-cyan-50 tw:hover:border-emerald-200 tw:transition-all duration-300 tw:group/item"
          >
            <div class="tw:flex-1">
              <p class="tw:text-gray-700 tw:font-semibold tw:text-sm tw:group-hover/item:tw:text-emerald-700 tw:transition-colors tw:flex tw:items-center tw:gap-2">
                <span>🌐</span> {{ t('setting.language_title') }}
              </p>
              <p class="tw:text-xs tw:text-gray-500 tw:mt-2">{{ t('setting.language_desc') }}</p>
              <div class="tw-mt-3">
                <a-select
                  :value="locale"
                  :options="languageOptions"
                  @change="handleLanguageChange"
                  class="tw:w-full"
                />
              </div>
            </div>
          </div>
          <!-- Java设置项 (仅系统管理设置显示) - 已注释 -->
          <!-- <div
            v-if="category.hasJava"
            class="tw:flex tw-col tw-justify-between tw-p-4 tw:border tw:border-gray-100 tw:rounded-xl tw-hover:bg-gradient-to-r tw:hover:from-emerald-50 tw:hover:to-cyan-50 tw:hover:border-emerald-200 tw:transition-all duration-300 tw:group/item"
          >
            <div class="tw:flex-1">
              <p class="tw:text-gray-700 tw:font-semibold tw:text-sm tw:group-hover/item:tw:text-emerald-700 tw:transition-colors tw:flex tw-items-center tw-gap-2">
                <span>☕</span> Java 设置
              </p>
              <div class="tw-mt-3 tw-space-y-2">
                <a-input
                  v-model:value="config.javaPath"
                  placeholder="Java 路径"
                  size="small"
                  class="tw-font-mono tw:text-xs"
                />
                <div class="tw:flex tw-gap-2">
                  <a-button
                    size="small"
                    :icon="h(SearchOutlined)"
                    @click="detectJavaPaths"
                    :loading="javaDetecting"
                    block
                  >
                    检测
                  </a-button>
                  <a-button
                    size="small"
                    @click="checkJavaVersion(config.javaPath)"
                    :loading="javaChecking"
                    block
                  >
                    检查
                  </a-button>
                </div>
                <div v-if="javaCheckResult" class="tw-p-2 tw:bg-gray-50 tw-rounded tw:text-xs tw:border tw:border-gray-200">
                  <div v-if="javaCheckResult.exists && javaCheckResult.version" class="tw-flex tw-items-center tw-gap-1">
                    <CheckOutlined class="tw-text-green-600" />
                    <span class="tw:text-gray-700 tw-font-medium">Java {{ javaCheckResult.version.fullVersion }}</span>
                  </div>
                  <div v-else class="tw-flex tw-items-center tw-gap-1">
                    <span class="tw:text-red-500">✗</span>
                    <span class="tw:text-red-600 tw-break-all">{{ javaCheckResult.error || 'Java 检查失败' }}</span>
                  </div>
                </div>
                <div v-if="javaPaths.length > 0" class="tw-max-h-32 tw-overflow-auto tw-space-y-1 tw:border tw:border-gray-200 tw-rounded tw-p-1 tw:bg-gray-50">
                  <div
                    v-for="(path, index) in javaPaths"
                    :key="index"
                    class="tw-p-1.5 tw-cursor-pointer tw-hover:tw:bg-emerald-100 tw-transition-colors tw:text-xs tw-font-mono tw-break-all tw-rounded"
                    :class="{ 'tw:bg-emerald-100': config.javaPath === path }"
                    @click="selectJavaPath(path)"
                  >
                    {{ path }}
                  </div>
                </div>
              </div>
            </div>
          </div> -->
          <div
            v-for="item in category.items"
            :key="item.key"
            class="tw:flex tw:items-center tw-justify-between tw-p-4 tw:border tw:border-gray-100 tw-rounded-xl tw-hover:bg-gradient-to-r tw:hover:from-emerald-50 tw:hover:to-cyan-50 tw:hover:border-emerald-200 tw:transition-all duration-300 tw:group/item"
          >
            <div class="tw:flex-1">
              <p class="tw:text-gray-700 tw:font-semibold tw:text-sm tw:group-hover/item:tw:text-emerald-700 tw:transition-colors">{{ item.name }}</p>
              <p class="tw:text-xs tw:text-gray-500 tw:mt-1">{{ item.description }}</p>
            </div>
            <a-switch
              :checked="getConfigValue(item.path)"
              @change="setConfigValue(item.path, $event)"
              :checked-children="t('setting.switch_on')"
              :un-checked-children="t('setting.switch_off')"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 淡入动画 */
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* 向上淡入动画 */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.tw-animate-fade-in {
    animation: fadeIn 0.6s ease-out;
}

.tw-animate-fade-in-up {
    animation: fadeInUp 0.6s ease-out;
    animation-fill-mode: both;
}
</style>
