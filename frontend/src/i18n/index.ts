import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import bg from './locales/bg.json';

const savedLanguage = localStorage.getItem('language') || 'bg';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bg: { translation: bg },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
