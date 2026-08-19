import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { LoadConfig } from '&/dex/backend/utils/configservice';
import { message } from 'ant-design-vue';

export interface AppConfig {
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
  showSponsorAd: boolean;
  javaPath?: string;
}

const CONFIG_KEY = 'deearthx_config';

const DEFAULT_CONFIG: AppConfig = {
  mirror: { bmclapi: true, mcimirror: 'partial' },
  filter: { hashes: true, dexpub: true, mixins: false, modrinth: true, mcmod: true },
  oaf: true,
  showSponsorAd: true,
  javaPath: undefined
};

export const useSettingStore = defineStore('setting', () => {
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG });
  const isLoaded = ref(false);
  const isSaving = ref(false);
  let isInitialLoad = true;

  function loadFromLocal(): AppConfig | null {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        return JSON.parse(raw) as AppConfig;
      }
    } catch (error) {
      console.warn('[SettingStore] 读取本地配置失败:', error);
    }
    return null;
  }

  function saveToLocal(newConfig: AppConfig): void {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
    } catch (error) {
      console.warn('[SettingStore] 保存本地配置失败:', error);
    }
  }

  async function initialize() {
    if (isLoaded.value) return;

    const localConfig = loadFromLocal();
    if (localConfig) {
      config.value = localConfig;
      console.log('[SettingStore] 已从本地加载配置');
    }

    isLoaded.value = true;

    // Push config to Go backend
    try {
      await LoadConfig(JSON.stringify(config.value));
      console.log('[SettingStore] 已同步配置到后端');
    } catch (error) {
      console.warn('[SettingStore] 同步配置到后端失败:', error);
    }

    isInitialLoad = false;
  }

  async function saveConfig(newConfig: AppConfig) {
    saveToLocal(newConfig);

    isSaving.value = true;
    try {
      await LoadConfig(JSON.stringify(newConfig));
    } catch (error) {
      console.error('[SettingStore] 同步配置到后端失败:', error);
      message.error('保存配置失败');
    }
    isSaving.value = false;
  }

  function setConfigValue(path: string, value: boolean | string) {
    const keys = path.split('.');
    let obj: any = config.value;

    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
  }

  function getConfigValue(path: string): boolean | string {
    const keys = path.split('.');
    let value: any = config.value;

    for (const key of keys) {
      value = value[key];
    }

    return value;
  }

  async function refreshConfig() {
    const localConfig = loadFromLocal();
    if (localConfig) {
      config.value = localConfig;
    }
    try {
      await LoadConfig(JSON.stringify(config.value));
    } catch (error) {
      console.warn('[SettingStore] 刷新配置失败:', error);
    }
  }

  watch(
    config,
    (newValue) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }
      saveConfig(newValue);
    },
    { deep: true }
  );

  return {
    config,
    isLoaded,
    isSaving,
    initialize,
    refreshConfig,
    setConfigValue,
    getConfigValue
  };
});
