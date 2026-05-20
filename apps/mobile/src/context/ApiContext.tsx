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

import {

  getDefaultApiBaseUrl,

  needsApiUrlSetup,

  normalizeApiBaseUrl,

} from "../config";

import {

  hasUserSavedApiUrl,

  loadApiBaseUrl,

  saveApiBaseUrl,

} from "../storage/settingsStorage";



type ApiContextValue = {

  apiBaseUrl: string;

  apiUrlNeedsSetup: boolean;

  userConfiguredApi: boolean;

  setApiBaseUrl: (url: string) => Promise<void>;

  resetApiBaseUrl: () => Promise<void>;

};



const ApiContext = createContext<ApiContextValue | null>(null);



export function ApiProvider({ children }: { children: ReactNode }) {

  const [apiBaseUrl, setUrl] = useState<string | null>(null);

  const [userConfiguredApi, setUserConfiguredApi] = useState(false);



  useEffect(() => {

    void (async () => {

      const [url, saved] = await Promise.all([

        loadApiBaseUrl(),

        hasUserSavedApiUrl(),

      ]);

      setUrl(url);

      setUserConfiguredApi(saved);

    })();

  }, []);



  const setApiBaseUrl = useCallback(async (url: string) => {

    const normalized = normalizeApiBaseUrl(url);

    await saveApiBaseUrl(normalized);

    setUrl(normalized);

    setUserConfiguredApi(true);

  }, []);



  const resetApiBaseUrl = useCallback(async () => {

    const def = getDefaultApiBaseUrl();

    await saveApiBaseUrl(def);

    setUrl(def);

    setUserConfiguredApi(false);

  }, []);



  const apiUrlNeedsSetup = useMemo(() => {
    if (!apiBaseUrl) return false;
    return needsApiUrlSetup(apiBaseUrl);
  }, [apiBaseUrl]);



  const value = useMemo(

    () =>

      apiBaseUrl

        ? {

            apiBaseUrl,

            apiUrlNeedsSetup,

            userConfiguredApi,

            setApiBaseUrl,

            resetApiBaseUrl,

          }

        : null,

    [

      apiBaseUrl,

      apiUrlNeedsSetup,

      userConfiguredApi,

      setApiBaseUrl,

      resetApiBaseUrl,

    ],

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

