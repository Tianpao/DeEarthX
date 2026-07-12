import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { Store } from '@tauri-apps/plugin-store';
import axios from '../utils/axios';
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
  autoZip: boolean;
  showSponsorAd: boolean;
  javaPath?: string;
}

const DEFAULT_CONFIG: AppConfig = {
  mirror: { bmclapi: false, mcimirror: 'on' },
  filter: { hashes: false, dexpub: false, mixins: false, modrinth: false, mcmod: false },
  oaf: false,
  autoZip: false,
  showSponsorAd: true,
  javaPath: undefined
};

// 全局 store 实例（延迟初始化）
let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await Store.get('settings.dat');
  }
  return storeInstance!;
}

export const useSettingStore = defineStore('setting', () => {
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG });
  const isLoaded = ref(false);
  const isSaving = ref(false);
  let isInitialLoad = true;

  // 从本地存储加载配置
  async function loadFromLocal(): Promise<AppConfig | null> {
    try {
      const store = await getStore();
      const savedConfig = await store.get<AppConfig>('config');
      if (savedConfig) {
        return savedConfig;
      }
    } catch (error) {
      console.warn('[SettingStore] 读取本地配置失败:', error);
    }
    return null;
  }

  // 保存到本地存储
  async function saveToLocal(newConfig: AppConfig): Promise<void> {
    try {
      const store = await getStore();
      await store.set('config', newConfig);
      await store.save();
    } catch (error) {
      console.warn('[SettingStore] 保存本地配置失败:', error);
    }
  }

  // 从后端加载配置
  async function loadFromBackend(): Promise<AppConfig | null> {
    try {
      const response = await axios.get<AppConfig>('/config/get');
      return response.data;
    } catch (error) {
      console.error('[SettingStore] 从后端加载配置失败:', error);
      return null;
    }
  }

  // 保存到后端
  async function saveToBackend(newConfig: AppConfig): Promise<boolean> {
    try {
      await axios.post('/config/post', newConfig, {
        headers: { 'Content-Type': 'application/json' }
      });
      window.dispatchEvent(new CustomEvent('config-changed'));
      return true;
    } catch (error) {
      console.error('[SettingStore] 保存配置到后端失败:', error);
      return false;
    }
  }

  // 初始化：本地优先，后台同步后端
  async function initialize() {
    if (isLoaded.value) return;

    // 1. 先从本地加载（快速显示）
    const localConfig = await loadFromLocal();
    if (localConfig) {
      // 直接赋值，不触发 watch（因为 isInitialLoad 还是 true）
      config.value = localConfig;
      console.log('[SettingStore] 已从本地加载配置');
    }

    // 2. 标记已加载，页面可以显示了
    isLoaded.value = true;

    // 3. 后台从后端同步（静默更新）
    const backendConfig = await loadFromBackend();
    if (backendConfig) {
      // 检查是否有差异，如果有则更新
      const hasDiff = JSON.stringify(config.value) !== JSON.stringify(backendConfig);
      if (hasDiff) {
        config.value = backendConfig;
        await saveToLocal(backendConfig);
        console.log('[SettingStore] 已从后端同步配置');
      }
    }

    // 4. 初始化完成，后续变更才触发保存
    isInitialLoad = false;
  }

  // 保存配置（双写）
  async function saveConfig(newConfig: AppConfig) {
    // 立即保存到本地
    await saveToLocal(newConfig);

    // 立即保存到后端
    isSaving.value = true;
    const success = await saveToBackend(newConfig);
    isSaving.value = false;
    if (!success) {
      message.error('保存配置失败');
    }
  }

  // 刷新配置（强制从后端获取）
  async function refreshConfig() {
    const backendConfig = await loadFromBackend();
    if (backendConfig) {
      config.value = backendConfig;
      await saveToLocal(backendConfig);
    }
  }

  // 设置配置值（通过路径）
  function setConfigValue(path: string, value: boolean | string) {
    const keys = path.split('.');
    let obj: any = config.value;

    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
  }

  // 获取配置值（通过路径）
  function getConfigValue(path: string): boolean | string {
    const keys = path.split('.');
    let value: any = config.value;

    for (const key of keys) {
      value = value[key];
    }

    return value;
  }

  // 监听配置变化，自动保存
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
