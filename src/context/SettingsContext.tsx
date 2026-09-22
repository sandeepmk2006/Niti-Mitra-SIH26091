/**
 * @fileoverview SettingsContext — small device-level app settings persisted in AsyncStorage.
 * (Account data such as name and preferences lives in Firestore via AuthContext instead.)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

import { loadStoredApiKey } from "../services/apiKey";

const STORAGE_KEY = "nitimitra.settings";

export interface AppSettings {
  /** Speak each new advisor reply automatically. */
  readAloud: boolean;
  /** Placeholder until push notifications exist. */
  notifications: boolean;
}

const DEFAULTS: AppSettings = { readAloud: false, notifications: true };

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULTS,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    // A Gemini key entered in Settings must be in place before the first request.
    loadStoredApiKey().catch((error) => console.warn("[Settings] Could not load API key:", error));
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const stored = JSON.parse(raw);
        setSettings((current) => ({
          readAloud: typeof stored.readAloud === "boolean" ? stored.readAloud : current.readAloud,
          notifications:
            typeof stored.notifications === "boolean" ? stored.notifications : current.notifications,
        }));
      })
      .catch((error) => console.warn("[Settings] Could not read settings:", error));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((error) =>
        console.warn("[Settings] Could not save settings:", error)
      );
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
