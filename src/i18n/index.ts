import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import kn from './kn.json';

/**
 * English, Kannada and Hindi. The text of the screens is translated; medicine names, prescription
 * data, PDFs and the messages that the business rules produce (src/domain) stay in English, because
 * the domain code is pure and has no UI language.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', locale: 'kn-IN' },
  { code: 'hi', label: 'हिन्दी', locale: 'hi-IN' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'pharmaflow-lang';

const isLanguage = (value: unknown): value is LanguageCode => LANGUAGES.some((l) => l.code === value);

/**
 * The saved choice, else English. The browser's own language is not used, so a demo always starts in
 * English unless the presenter picks another language.
 */
export function savedLanguage(): LanguageCode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : 'en';
  } catch {
    return 'en';
  }
}

export function localeFor(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.locale ?? 'en-IN';
}

/** Changes the language of this tab and remembers it. Other open tabs and panes follow through the storage event. */
export function setLanguage(code: LanguageCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode: the choice just lasts until the tab closes */
  }
  void i18n.changeLanguage(code);
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, kn: { translation: kn }, hi: { translation: hi } },
  lng: savedLanguage(),
  fallbackLng: 'en',
  supportedLngs: LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false },
  // The resources are bundled, so the first render already has the text.
  initAsync: false,
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language;
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && isLanguage(e.newValue) && e.newValue !== i18n.language) void i18n.changeLanguage(e.newValue);
  });
}

export default i18n;
