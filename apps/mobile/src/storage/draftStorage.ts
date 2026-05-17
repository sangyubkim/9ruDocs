import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BlogDraft, Step } from "../types";

const KEY = "@9rudocs/draft";

function isValidDraft(data: unknown): data is BlogDraft {
  if (!data || typeof data !== "object") return false;
  const d = data as BlogDraft;
  return Array.isArray(d.steps) && typeof d.id === "string";
}

export async function loadDraft(): Promise<BlogDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    await AsyncStorage.removeItem(KEY);
    return null;
  }
}

export async function saveDraft(draft: BlogDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export function createEmptyDraft(): BlogDraft {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}`,
    title: "",
    steps: [],
    body: "",
    excerpt: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createStep(order: number): Step {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageUri: null,
    caption: "",
    order,
  };
}
