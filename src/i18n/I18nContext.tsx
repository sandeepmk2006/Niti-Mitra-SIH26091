/**
 * @fileoverview I18nContext — global UI language state.
 *
 * The chosen language is persisted in AsyncStorage. `hasChosenLanguage` is false until the user
 * picks one, which is what routes a first launch to the language-selection screen. Changing the
 * language re-renders every consumer of `t()`, so the whole UI switches instantly.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { DEFAULT_LANGUAGE, LanguageCode, getLanguage, isLanguageCode } from "./languages";
import { translate, TranslateFn } from "./translate";

const STORAGE_KEY = "nitimitra.language";

export { translate } from "./translate";
export type { TranslateFn, TranslateParams } from "./translate";

interface I18nContextValue {
  language: LanguageCode;
  /** BCP-47 locale for date/time formatting, e.g. "hi-IN". */
  locale: string;
  hasChosenLanguage: boolean;
  /** False until the stored preference has been read. */
  isReady: boolean;
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: TranslateFn;
}

// The default value lets components rendered outside the provider (e.g. the root error
// boundary) still translate — into English.
const I18nContext = createContext<I18nContextValue>({
  language: DEFAULT_LANGUAGE,
  locale: getLanguage(DEFAULT_LANGUAGE).locale,
  hasChosenLanguage: false,
  isReady: false,
  setLanguage: async () => {},
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [hasChosenLanguage, setHasChosenLanguage] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isLanguageCode(stored)) {
          setLanguageState(stored);
          setHasChosenLanguage(true);
        }
      })
      .catch((error) => console.warn("[I18n] Could not read stored language:", error))
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    setLanguageState(code);
    setHasChosenLanguage(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch (error) {
      console.warn("[I18n] Could not persist language:", error);
    }
  }, []);

  const t = useCallback<TranslateFn>(
    (key, params) => translate(language, key, params),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      locale: getLanguage(language).locale,
      hasChosenLanguage,
      isReady,
      setLanguage,
      t,
    }),
    [language, hasChosenLanguage, isReady, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
