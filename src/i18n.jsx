import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localizeQuestion,
  localizeTest,
  translateAcademicText,
  translateSubject,
  translateUi,
} from "./localization.js";

const STORAGE_KEY = "vijetha-language";
const I18nContext = createContext(null);

function initialLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LOCALES.some((item) => item.code === stored) ? stored : DEFAULT_LOCALE;
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(initialLocale);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      locales: SUPPORTED_LOCALES,
      setLocale,
      t: (key, replacements) => translateUi(key, locale, replacements),
      text: (content) => translateAcademicText(content, locale),
      subject: (content) => translateSubject(content, locale),
      question: (content) => localizeQuestion(content, locale),
      test: (content) => localizeTest(content, locale),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider.");
  return context;
}

export function LanguageSelector({ compact = false, className = "" }) {
  const { locale, locales, setLocale, t } = useI18n();
  return (
    <label className={`language-selector ${compact ? "compact" : ""} ${className}`.trim()}>
      <span>{compact ? t("language") : t("chooseLanguage")}</span>
      <select
        aria-label={t("chooseLanguage")}
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
      >
        {locales.map((item) => (
          <option key={item.code} value={item.code}>
            {compact ? item.shortLabel : item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
