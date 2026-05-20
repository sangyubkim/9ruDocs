import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BlogDraft, Step, StepStatus } from "../types";

const KEY = "@9rudocs/draft";

function isValidDraft(data: unknown): data is BlogDraft {
  if (!data || typeof data !== "object") return false;
  const d = data as BlogDraft;
  return Array.isArray(d.steps) && typeof d.id === "string";
}

function normalizeStatus(status: unknown): StepStatus {
  return status === "completed" ? "completed" : "editing";
}

export function normalizeStep(step: Step): Step {
  return {
    ...step,
    status: normalizeStatus(step.status),
    location: step.location ?? null,
  };
}

function normalizeDraft(draft: BlogDraft): BlogDraft {
  return {
    ...draft,
    steps: draft.steps.map((s, i) =>
      normalizeStep({ ...s, order: typeof s.order === "number" ? s.order : i }),
    ),
  };
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
    return normalizeDraft(parsed);
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
    tone: "friendly",
    ai: {},
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
    status: "editing",
    location: null,
  };
}
