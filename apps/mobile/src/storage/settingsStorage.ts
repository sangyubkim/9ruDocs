import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDefaultApiBaseUrl } from "../config";

const KEY = "@9rudocs/api-base-url";

export async function loadApiBaseUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved?.trim()) return saved.trim().replace(/\/+$/, "");
  } catch {
    /* ignore */
  }
  return getDefaultApiBaseUrl();
}

export async function saveApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEY, url.trim().replace(/\/+$/, ""));
}
