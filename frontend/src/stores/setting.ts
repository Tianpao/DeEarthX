import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { ConfigService } from '@/bindings/deearthx/core/services';
import type { IConfig } from '@/bindings/deearthx/core/config/models';

const STORAGE_KEY = 'deearthx-config';

function loadFromLocalStorage(): IConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[SettingStore] Failed to load config from localStorage:', e);
  }
  return null;
}

function saveToLocalStorage(cfg: IConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn('[SettingStore] Failed to save config to localStorage:', e);
  }
}

function defaultConfig(): IConfig {
  return {
    mirror: { bmclapi: true, mcimirror: 'on' },
    filter: { hashes: false, dexpub: false, mixins: false, modrinth: false, mcmod: false },
    oaf: false,
    autoZip: false,
    showSponsorAd: true,
    logLevel: 'info',
  };
}

export const useSettingStore = defineStore('setting', () => {
  const config = ref<IConfig>(defaultConfig());
  const isLoaded = ref(false);
  const isSaving = ref(false);
  let isInitialLoad = true;

  async function initialize() {
    if (isLoaded.value) return;

    // 1. Load from localStorage first (instant)
    const localConfig = loadFromLocalStorage();
    if (localConfig) {
      config.value = localConfig;
    }

    isLoaded.value = true;

    // 2. Sync from backend (silent background update)
    try {
      const backendConfig = await ConfigService.GetConfig();
      if (backendConfig) {
        const hasDiff = JSON.stringify(config.value) !== JSON.stringify(backendConfig);
        if (hasDiff) {
          config.value = backendConfig;
          saveToLocalStorage(backendConfig);
        }
      }
    } catch (e) {
      // Backend not ready yet — send local config to backend
      await ConfigService.SaveConfig(config.value);
    }

    isInitialLoad = false;
  }

  async function saveConfig(cfg: IConfig) {
    saveToLocalStorage(cfg);
    isSaving.value = true;
    try {
      await ConfigService.SaveConfig(cfg);
      window.dispatchEvent(new CustomEvent('config-changed'));
    } catch {
      message.error('保存配置失败');
    }
    isSaving.value = false;
  }

  async function refreshConfig() {
    try {
      const backendConfig = await ConfigService.GetConfig();
      if (backendConfig) {
        config.value = backendConfig;
        saveToLocalStorage(backendConfig);
      }
    } catch { /* ignore */ }
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
