<script lang="ts" setup>
import { ref, watch, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { setLanguage, type Language } from '../utils/i18n';
import axios from '../utils/axios';

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
  oaf: boolean;
  autoZip: boolean;
  javaPath?: string;
}

interface SettingItem {
  key: string;
  name: string;
  description: string;
  path: string;
  defaultValue: boolean;
}

interface SettingCategory {
  id: string;
  title: string;
  icon: string;
  bgColor: string;
  textColor: string;
  items: SettingItem[];
  hasJava?: boolean;
  hasLanguage?: boolean;
}

const config = ref<AppConfig>({
  mirror: { bmclapi: false, mcimirror: false },
  filter: { hashes: false, dexpub: false, mixins: false, modrinth: false },
  oaf: false,
  autoZip: false,
  javaPath: undefined
});

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

const languageOptions = computed(() => {
  return [
    { label: '简体中文', value: 'zh_cn' },
    { label: '繁體中文（香港）', value: 'zh_hk' },
    { label: '繁體中文（台灣）', value: 'zh_tw' },
    { label: 'English', value: 'en_us' },
    { label: '日本語', value: 'ja_jp' },
    { label: 'Français', value: 'fr_fr' },
    { label: 'Deutsch', value: 'de_de' },
    { label: 'Español', value: 'es_es' }
  ];
});

function handleLanguageChange(value: Language) {
  setLanguage(value);
}

const { t, locale } = useI18n();

function getConfigValue(path: string): boolean {
  const keys = path.split('.');
  let value: any = config.value;

  for (const key of keys) {
    value = value[key];
  }

  if (typeof value === 'boolean') {
    return value;
  }

  console.warn(`Config value at path "${path}" is not a boolean:`, value);
  return false;
}

function setConfigValue(path: string, newValue: boolean): void {
  const keys = path.split('.');
  let obj: any = config.value;

  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
  }

  obj[keys[keys.length - 1]] = newValue;
}

async function loadConfig() {
  try {
    const response = await axios.get('/config/get');
    config.value = response.data;
    console.log('[Setting] 配置已从后端刷新');
  } catch (error) {
    console.error('加载配置失败:', error);
    message.error(t('setting.config_load_failed'));
  }
}

defineExpose({
  refreshConfig: loadConfig
});

async function saveConfig(newConfig: AppConfig) {
  try {
    await axios.post('/config/post', newConfig, {
      headers: { 'Content-Type': 'application/json' }
    });
    message.success(t('setting.config_saved'));
  } catch (error) {
    console.error('保存配置失败:', error);
    message.error(t('setting.config_save_failed'));
  }
}

onMounted(() => {
  loadConfig();
});

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
      <div class="tw:text-center tw:mb-10 tw:animate-fade-in">
        <h1 class="tw:text-4xl tw:font-bold tw:tracking-tight tw:mb-3">
          <span class="tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
            {{ t('common.app_name') }}
          </span>
          <span class="tw:text-gray-800">{{ t('menu.setting') }}</span>
        </h1>
        <p class="tw:text-gray-500 tw:text-lg">{{ t('setting.subtitle') }}</p>
      </div>

      <div
        v-for="(category, index) in settings"
        :key="category.id"
        class="tw-bg-white tw:rounded-2xl tw:shadow-lg tw:p-7 tw:mb-6 tw:animate-fade-in-up tw:group tw:border tw:border-gray-100 tw:hover:tw:border-emerald-200 tw:transition-all duration-300"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <h2 class="tw:text-xl tw:font-bold tw:text-gray-800 tw-mb-6 tw:flex tw:items-center tw:group-hover:tw:translate-x-2 tw:transition-transform duration-300">
          <span :class="[category.bgColor, category.textColor, 'tw-w-10 tw:h-10 tw:rounded-xl tw:flex tw:items-center tw:justify-center tw-mr-3 tw:shadow-md']">
            {{ category.icon }}
          </span>
          {{ category.title }}
        </h2>

        <div class="tw:grid tw:grid-cols-1 md:tw:grid-cols-2 lg:tw:grid-cols-3 tw:gap-4">
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
          <div
            v-for="item in category.items"
            :key="item.key"
            class="tw:flex tw:items-center tw:justify-between tw-p-4 tw:border tw:border-gray-100 tw:rounded-xl tw-hover:bg-gradient-to-r tw:hover:from-emerald-50 tw:hover:to-cyan-50 tw:hover:border-emerald-200 tw:transition-all duration-300 tw:group/item"
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
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

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
