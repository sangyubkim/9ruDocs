import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BlogDraft, DraftListState, Step, StepStatus } from "../types";
import { createEmptyRestaurantData, normalizeRestaurantData } from "../utils/restaurantTemplate";

const LEGACY_KEY = "@9rudocs/draft";
const DRAFTS_KEY = "@9rudocs/drafts";
const ACTIVE_KEY = "@9rudocs/active-draft-id";

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
  const template = draft.template === "basic" ? "basic" : "restaurant";
  return {
    ...draft,
    template,
    restaurant:
      template === "restaurant"
        ? normalizeRestaurantData(draft.restaurant ?? createEmptyRestaurantData())
        : draft.restaurant,
    steps: draft.steps.map((s, i) =>
      normalizeStep({ ...s, order: typeof s.order === "number" ? s.order : i }),
    ),
  };
}

async function migrateLegacyDraft(): Promise<DraftListState | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) {
      await AsyncStorage.removeItem(LEGACY_KEY);
      return null;
    }
    const draft = normalizeDraft({ ...parsed, template: "restaurant" });
    await AsyncStorage.removeItem(LEGACY_KEY);
    return { drafts: [draft], activeId: draft.id };
  } catch {
    await AsyncStorage.removeItem(LEGACY_KEY);
    return null;
  }
}

export async function loadDraftState(): Promise<DraftListState> {
  const migrated = await migrateLegacyDraft();
  if (migrated) {
    await saveDraftState(migrated);
    return migrated;
  }

  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    if (!raw) {
      const initial = createInitialState();
      await saveDraftState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as { drafts?: unknown; activeId?: string };
    const drafts = Array.isArray(parsed.drafts)
      ? parsed.drafts.filter(isValidDraft).map(normalizeDraft)
      : [];
    if (drafts.length === 0) {
      const initial = createInitialState();
      await saveDraftState(initial);
      return initial;
    }
    const activeId =
      parsed.activeId && drafts.some((d) => d.id === parsed.activeId)
        ? parsed.activeId
        : drafts[0].id;
    return { drafts, activeId };
  } catch {
    const initial = createInitialState();
    await saveDraftState(initial);
    return initial;
  }
}

export async function saveDraftState(state: DraftListState): Promise<void> {
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(state));
  await AsyncStorage.setItem(ACTIVE_KEY, state.activeId);
}

/** @deprecated 단일 초안 호환 */
export async function loadDraft(): Promise<BlogDraft | null> {
  const state = await loadDraftState();
  return state.drafts.find((d) => d.id === state.activeId) ?? null;
}

/** @deprecated 단일 초안 호환 */
export async function saveDraft(draft: BlogDraft): Promise<void> {
  const state = await loadDraftState();
  const idx = state.drafts.findIndex((d) => d.id === draft.id);
  const normalized = normalizeDraft(draft);
  const drafts =
    idx >= 0
      ? state.drafts.map((d, i) => (i === idx ? normalized : d))
      : [...state.drafts, normalized];
  await saveDraftState({ drafts, activeId: normalized.id });
}

export function createInitialState(): DraftListState {
  const draft = createEmptyDraft();
  return { drafts: [draft], activeId: draft.id };
}

export function createEmptyDraft(template: BlogDraft["template"] = "restaurant"): BlogDraft {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}`,
    title: "",
    template,
    restaurant: template === "restaurant" ? createEmptyRestaurantData() : undefined,
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

export function upsertDraftInState(
  state: DraftListState,
  draft: BlogDraft,
): DraftListState {
  const normalized = normalizeDraft(draft);
  const idx = state.drafts.findIndex((d) => d.id === normalized.id);
  const drafts =
    idx >= 0
      ? state.drafts.map((d, i) => (i === idx ? normalized : d))
      : [...state.drafts, normalized];
  return { drafts, activeId: normalized.id };
}

export function removeDraftsFromState(
  state: DraftListState,
  ids: Set<string>,
): DraftListState {
  const drafts = state.drafts.filter((d) => !ids.has(d.id));
  if (drafts.length === 0) {
    const fresh = createEmptyDraft();
    return { drafts: [fresh], activeId: fresh.id };
  }
  const activeId = drafts.some((d) => d.id === state.activeId)
    ? state.activeId
    : drafts[0].id;
  return { drafts, activeId };
}

export function switchActiveDraft(
  state: DraftListState,
  draftId: string,
): DraftListState {
  if (!state.drafts.some((d) => d.id === draftId)) return state;
  return { ...state, activeId: draftId };
}

export function addNewDraftToState(state: DraftListState): DraftListState {
  const draft = createEmptyDraft();
  return { drafts: [...state.drafts, draft], activeId: draft.id };
}

export function getActiveDraft(state: DraftListState): BlogDraft {
  return (
    state.drafts.find((d) => d.id === state.activeId) ??
    state.drafts[0] ??
    createEmptyDraft()
  );
}

export function draftDisplayTitle(draft: BlogDraft): string {
  if (draft.title.trim()) return draft.title.trim();
  if (draft.template === "restaurant" && draft.restaurant?.restaurantName) {
    return draft.restaurant.restaurantName;
  }
  if (draft.steps[0]?.caption) {
    return draft.steps[0].caption.slice(0, 30);
  }
  return "제목 없음";
}
