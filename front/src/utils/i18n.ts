import { createI18n } from 'vue-i18n';
import zhCn from '../../lang/zh_cn.json';
import zhHk from '../../lang/zh_hk.json';
import zhTw from '../../lang/zh_tw.json';
import enUs from '../../lang/en_us.json';
import jaJp from '../../lang/ja_jp.json';
import frFr from '../../lang/fr_fr.json';
import deDe from '../../lang/de_de.json';
import esEs from '../../lang/es_es.json';

export type Language = 'zh_cn' | 'zh_hk' | 'zh_tw' | 'en_us' | 'ja_jp' | 'fr_fr' | 'de_de' | 'es_es';

const messages = {
  zh_cn: zhCn,
  zh_hk: zhHk,
  zh_tw: zhTw,
  en_us: enUs,
  ja_jp: jaJp,
  fr_fr: frFr,
  de_de: deDe,
  es_es: esEs
};

const LANGUAGE_STORAGE_KEY = 'deearthx_language';

const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
const defaultLocale = savedLanguage && messages[savedLanguage] ? savedLanguage : 'zh_cn';

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: 'zh_cn',
  messages,
  globalInjection: true
});

export function setLanguage(lang: Language) {
  if (i18n.global.locale.value !== lang) {
    i18n.global.locale.value = lang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }
}

export function getLanguage(): Language {
  return i18n.global.locale.value as Language;
}

export default i18n;
