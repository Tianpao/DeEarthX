import { ref, computed } from 'vue';

// 支持的语言类型
export type Language = 'zh_cn' | 'en_us' | 'ja_jp' | 'fr_fr' | 'de_de' | 'es_es';

// 语言数据类型
export type LanguageData = Record<string, any>;

// 语言数据存储
const messages: Record<Language, LanguageData> = {
  zh_cn: {},
  en_us: {},
  ja_jp: {},
  fr_fr: {},
  de_de: {},
  es_es: {}
};

// 当前语言状态（使用 ref 以支持响应式）
const currentLanguage = ref<Language>('zh_cn');

// 用于强制更新的版本号
const version = ref(0);

// 本地存储键名
const LANGUAGE_STORAGE_KEY = 'deearthx_language';

/**
 * 初始化 i18n
 */
export async function initI18n() {
  // 从本地存储读取语言设置
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
  if (savedLanguage && ['zh_cn', 'en_us', 'ja_jp', 'fr_fr', 'de_de', 'es_es'].includes(savedLanguage)) {
    currentLanguage.value = savedLanguage;
  }

  // 加载语言文件
  await loadLanguageFile('zh_cn');
  await loadLanguageFile('en_us');
  await loadLanguageFile('ja_jp');
  await loadLanguageFile('fr_fr');
  await loadLanguageFile('de_de');
  await loadLanguageFile('es_es');

  // 强制更新所有依赖的 computed 属性
  version.value++;
}

/**
 * 加载语言文件
 */
async function loadLanguageFile(lang: Language) {
  try {
    const response = await fetch(`/lang/${lang}.json`);
    if (response.ok) {
      messages[lang] = await response.json();
    }
  } catch (error) {
    console.error(`Failed to load language file: ${lang}`, error);
  }
}

/**
 * 切换语言
 */
export function setLanguage(lang: Language) {
  if (lang !== currentLanguage.value) {
    currentLanguage.value = lang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    // 强制更新所有依赖的 computed 属性
    version.value++;
  }
}

/**
 * 获取当前语言
 */
export function getLanguage(): Language {
  return currentLanguage.value;
}

/**
 * 根据路径获取翻译文本
 * 支持嵌套路径，如 'menu.home'
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const lang = currentLanguage.value;
  const message = messages[lang];

  // 如果语言文件为空，返回路径本身
  if (!message || Object.keys(message).length === 0) {
    return path;
  }

  // 按点号分割路径
  const keys = path.split('.');
  let value: any = message;

  // 遍历路径获取值
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // 如果找不到翻译，返回路径本身
      return path;
    }
  }

  // 如果值不是字符串，返回路径
  if (typeof value !== 'string') {
    return path;
  }

  // 替换参数占位符
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  return value;
}

/**
 * 创建 i18n composable
 */
export function useI18n() {
  const language = computed(() => currentLanguage.value);
  // 导出 version 以便在 computed 中建立依赖
  const translationVersion = computed(() => version.value);

  return {
    language,
    t,
    setLanguage,
    translationVersion
  };
}
