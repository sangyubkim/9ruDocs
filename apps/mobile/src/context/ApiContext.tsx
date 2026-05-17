import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, View } from "react-native";
import { getDefaultApiBaseUrl } from "../config";
import { loadApiBaseUrl, saveApiBaseUrl } from "../storage/settingsStorage";

type ApiContextValue = {
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => Promise<void>;
  resetApiBaseUrl: () => Promise<void>;
};

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadApiBaseUrl().then(setUrl);
  }, []);

  const setApiBaseUrl = useCallback(async (url: string) => {
    const normalized = url.trim().replace(/\/+$/, "");
    await saveApiBaseUrl(normalized);
    setUrl(normalized);
  }, []);

  const resetApiBaseUrl = useCallback(async () => {
    const def = getDefaultApiBaseUrl();
    await saveApiBaseUrl(def);
    setUrl(def);
  }, []);

  const value = useMemo(
    () =>
      apiBaseUrl
        ? { apiBaseUrl, setApiBaseUrl, resetApiBaseUrl }
        : null,
    [apiBaseUrl, setApiBaseUrl, resetApiBaseUrl],
  );

  if (!value) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("useApi outside ApiProvider");
  return ctx;
}
