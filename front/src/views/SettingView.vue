<script lang="ts" setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import type { Component } from 'vue';
import { message } from 'ant-design-vue';
import {
  ApiOutlined,
  CloudDownloadOutlined,
  GlobalOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  ToolOutlined
} from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { setLanguage, type Language } from '../utils/i18n';
import axios from '../utils/axios';

interface AppConfig {
  mirror: {
    bmclapi: boolean;
    mcimirror: 'on' | 'off' | 'partial';
  };
  filter: {
    hashes: boolean;
    dexpub: boolean;
    mixins: boolean;
    modrinth: boolean;
    mcmod: boolean;
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

interface SettingSelectItem {
  key: string;
  name: string;
  description: string;
  path: string;
  options: { label: string; value: string }[];
}

interface SettingCategory {
  id: string;
  title: string;
  icon: Component;
  accent: 'emerald' | 'sky' | 'slate';
  items: SettingItem[];
  selectItems?: SettingSelectItem[];
  hasLanguage?: boolean;
}

const { t, locale } = useI18n();

const config = ref<AppConfig>({
  mirror: { bmclapi: false, mcimirror: 'on' },
  filter: { hashes: false, dexpub: false, mixins: false, modrinth: false, mcmod: false },
  oaf: false,
  autoZip: false,
  javaPath: undefined
});

const categoryAccentClasses: Record<SettingCategory['accent'], { badge: string; soft: string; text: string; border: string }> = {
  emerald: {
    badge: 'tw:bg-emerald-50 tw:text-emerald-700 tw:ring-1 tw:ring-emerald-200',
    soft: 'tw:bg-emerald-50',
    text: 'tw:text-emerald-700',
    border: 'hover:tw:border-emerald-200'
  },
  sky: {
    badge: 'tw:bg-sky-50 tw:text-sky-700 tw:ring-1 tw:ring-sky-200',
    soft: 'tw:bg-sky-50',
    text: 'tw:text-sky-700',
    border: 'hover:tw:border-sky-200'
  },
  slate: {
    badge: 'tw:bg-slate-100 tw:text-slate-700 tw:ring-1 tw:ring-slate-200',
    soft: 'tw:bg-slate-100',
    text: 'tw:text-slate-700',
    border: 'hover:tw:border-slate-300'
  }
};

const settings = computed<SettingCategory[]>(() => {
  return [
    {
      id: 'filter',
      title: t('setting.category_filter'),
      icon: SafetyCertificateOutlined,
      accent: 'emerald',
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
          key: 'mcmod',
          name: t('setting.filter_mcmod_name'),
          description: t('setting.filter_mcmod_desc'),
          path: 'filter.mcmod',
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
      icon: CloudDownloadOutlined,
      accent: 'sky',
      selectItems: [
        {
          key: 'mcimirror',
          name: t('setting.mirror_mcimirror_name'),
          description: t('setting.mirror_mcimirror_desc'),
          path: 'mirror.mcimirror',
          options: [
            { label: t('setting.mirror_mcim_on'), value: 'on' },
            { label: t('setting.mirror_mcim_partial'), value: 'partial' },
            { label: t('setting.mirror_mcim_off'), value: 'off' }
          ]
        }
      ],
      items: [
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
      icon: ToolOutlined,
      accent: 'slate',
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
    { label: 'English', value: 'en_us' }
  ];
});

function handleLanguageChange(value: Language) {
  setLanguage(value);
}

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

function getSelectConfigValue(path: string): string {
  const keys = path.split('.');
  let value: any = config.value;

  for (const key of keys) {
    value = value[key];
  }

  if (typeof value === 'string') {
    return value;
  }

  console.warn(`Config value at path "${path}" is not a string:`, value);
  return 'on';
}

function setSelectConfigValue(path: string, newValue: string): void {
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
  } catch (error) {
    console.error('保存配置失败:', error);
    message.error(t('setting.config_save_failed'));
  }
}

let isInitialLoad = true;
watch(config, (newValue) => {
  if (isInitialLoad) {
    isInitialLoad = false;
    return;
  }
  saveConfig(newValue);
}, { deep: true });

onMounted(() => {
  loadConfig();
});

onUnmounted(() => {
  isInitialLoad = true;
});
</script>

<template>
  <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
    <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-5xl tw:flex-col tw:gap-6">
      <div class="tw:flex tw:items-center tw:justify-between">
        <div>
          <h1 class="tw:text-2xl tw:font-semibold tw:text-slate-900">{{ t('menu.setting') }}</h1>
          <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('setting.subtitle') }}</p>
        </div>
        <span class="flowing-brand-text tw:text-4xl tw:font-semibold">{{ t('common.app_name') }}</span>
      </div>

      <section
        v-for="category in settings"
        :key="category.id"
        class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm"
      >
        <div class="tw:mb-4 tw:flex tw:items-center tw:gap-3">
          <div class="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <div
              class="tw:flex tw:h-10 tw:w-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg"
              :class="categoryAccentClasses[category.accent].badge"
            >
              <component :is="category.icon" class="tw:text-[18px]" />
            </div>
            <h2 class="tw:text-lg tw:font-semibold tw:text-slate-900">{{ category.title }}</h2>
          </div>
        </div>

        <div class="tw:grid tw:grid-cols-1 tw:gap-3 md:tw:grid-cols-2 xl:tw:grid-cols-3">
          <article
            v-if="category.hasLanguage"
            class="setting-card tw:flex tw:min-h-[72px] tw:items-center tw:justify-between tw:gap-2.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-2.5 tw:transition-colors hover:tw:bg-white"
            :class="categoryAccentClasses[category.accent].border"
          >
            <div class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2.5">
              <div
                class="tw:flex tw:h-6 tw:w-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md"
                :class="[categoryAccentClasses[category.accent].soft, categoryAccentClasses[category.accent].text]"
              >
                <GlobalOutlined />
              </div>
              <div class="tw:min-w-0 tw:flex-1">
                <h3 class="tw:text-[13px] tw:font-semibold tw:text-slate-900">{{ t('setting.language_title') }}</h3>
                <p class="tw:mt-0.5 tw:line-clamp-1 tw:text-xs tw:leading-4 tw:text-slate-500">{{ t('setting.language_desc') }}</p>
              </div>
            </div>
            <a-select
              :value="locale"
              :options="languageOptions"
              @change="handleLanguageChange"
              class="tw:w-32 tw:shrink-0"
            />
          </article>

          <article
            v-for="item in category.items"
            :key="item.key"
            class="setting-card tw:flex tw:min-h-[72px] tw:items-center tw:justify-between tw:gap-2.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-2.5 tw:transition-colors hover:tw:bg-white"
            :class="categoryAccentClasses[category.accent].border"
          >
            <div class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2.5">
              <div
                class="tw:flex tw:h-6 tw:w-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md"
                :class="[categoryAccentClasses[category.accent].soft, categoryAccentClasses[category.accent].text]"
              >
                <ApiOutlined v-if="category.id === 'filter'" />
                <CloudDownloadOutlined v-else-if="category.id === 'mirror'" />
                <SettingOutlined v-else />
              </div>
              <div class="tw:min-w-0 tw:flex-1">
                <h3 class="tw:text-[13px] tw:font-semibold tw:text-slate-900">{{ item.name }}</h3>
                <p class="tw:mt-0.5 tw:line-clamp-1 tw:text-xs tw:leading-4 tw:text-slate-500">{{ item.description }}</p>
              </div>
            </div>
            <a-switch
              class="tw:shrink-0"
              :checked="getConfigValue(item.path)"
              @change="setConfigValue(item.path, $event)"
              :checked-children="t('setting.switch_on')"
              :un-checked-children="t('setting.switch_off')"
            />
          </article>

          <article
            v-for="item in category.selectItems"
            :key="item.key"
            class="setting-card tw:flex tw:min-h-[72px] tw:items-center tw:justify-between tw:gap-2.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-2.5 tw:transition-colors hover:tw:bg-white"
            :class="categoryAccentClasses[category.accent].border"
          >
            <div class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2.5">
              <div
                class="tw:flex tw:h-6 tw:w-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md"
                :class="[categoryAccentClasses[category.accent].soft, categoryAccentClasses[category.accent].text]"
              >
                <CloudDownloadOutlined />
              </div>
              <div class="tw:min-w-0 tw:flex-1">
                <h3 class="tw:text-[13px] tw:font-semibold tw:text-slate-900">{{ item.name }}</h3>
                <p class="tw:mt-0.5 tw:line-clamp-1 tw:text-xs tw:leading-4 tw:text-slate-500">{{ item.description }}</p>
              </div>
            </div>
            <a-segmented
              :value="getSelectConfigValue(item.path)"
              :options="item.options"
              @change="setSelectConfigValue(item.path, $event)"
              class="tw:shrink-0"
            />
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.flowing-brand-text {
  background: linear-gradient(110deg, #10b981 0%, #0ea5e9 32%, #22c55e 64%, #38bdf8 82%, #10b981 100%);
  background-size: 260% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: flowingTextColor 4.8s linear infinite;
}

.setting-card {
  text-wrap: pretty;
}

@keyframes flowingTextColor {
  from {
    background-position: 0% 50%;
  }
  to {
    background-position: 260% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flowing-brand-text {
    animation: none;
  }
}
</style>
