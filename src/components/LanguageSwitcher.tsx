import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n';

/** English, Kannada or Hindi. The choice is remembered, and the "All 4" panes follow it. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
      <Languages className="size-4" aria-hidden />
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="bg-transparent text-sm outline-none"
        aria-label={t('common.language')}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
