import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDefaultApiBaseUrl, normalizeApiBaseUrl } from "../config";

const KEY = "@9rudocs/api-base-url";
const SETUP_PROMPT_KEY = "@9rudocs/api-setup-prompt-shown";

export async function hasUserSavedApiUrl(): Promise<boolean> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    return !!saved?.trim();
  } catch {
    return false;
  }
}

export async function loadApiBaseUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved?.trim()) return normalizeApiBaseUrl(saved);
  } catch {
    /* ignore */
  }
  return getDefaultApiBaseUrl();
}

export async function saveApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEY, normalizeApiBaseUrl(url));
}

export async function wasApiSetupPromptShown(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SETUP_PROMPT_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markApiSetupPromptShown(): Promise<void> {
  await AsyncStorage.setItem(SETUP_PROMPT_KEY, "1");
}
