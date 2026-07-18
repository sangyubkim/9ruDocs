import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { formatNetworkError, generateBlog } from "./src/api/blog";
import { generateRestaurantBlog } from "./src/api/restaurant";
import { setApiClientBaseUrl } from "./src/api/client";
import {
  DraftDrawer,
  type DraftDrawerHandle,
} from "./src/components/DraftDrawer";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { ApiProvider, useApi } from "./src/context/ApiContext";
import {
  markApiSetupPromptShown,
  wasApiSetupPromptShown,
} from "./src/storage/settingsStorage";
import {
  addNewDraftToState,
  createEmptyDraft,
  getActiveDraft,
  loadDraftState,
  removeDraftsFromState,
  saveDraftState,
  switchActiveDraft,
  upsertDraftInState,
} from "./src/storage/draftStorage";
import { restaurantToMarkdown, normalizeRestaurantData, createEmptyRestaurantData } from "./src/utils/restaurantTemplate";
import type { BlogDraft, DraftListState, Screen } from "./src/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { EditScreen } from "./src/screens/EditScreen";
import { BlogPreviewScreen } from "./src/screens/BlogPreviewScreen";
import { PublishScreen } from "./src/screens/PublishScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { RestaurantTemplateScreen } from "./src/screens/RestaurantTemplateScreen";

function AppInner() {
  const { apiBaseUrl, apiUrlNeedsSetup } = useApi();
  const [screen, setScreen] = useState<Screen>("home");
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const drawerRef = useRef<DraftDrawerHandle>(null);
  const [draftState, setDraftState] = useState<DraftListState>(() => {
    const initial = createEmptyDraft();
    return { drafts: [initial], activeId: initial.id };
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const draft = getActiveDraft(draftState);

  /** 앞으로 이동 — 히스토리에 현재 화면을 쌓음 */
  const navigateTo = useCallback((next: Screen) => {
    setScreen((prev) => {
      if (prev === next) return prev;
      setScreenHistory((h) => [...h, prev]);
      return next;
    });
  }, []);

  /** 홈으로 리셋 (히스토리 비움) */
  const resetToHome = useCallback(() => {
    setScreenHistory([]);
    setScreen("home");
  }, []);

  /** Android 뒤로가기 / UI 뒤로 — true면 앱 종료 막음 */
  const handleHardwareBack = useCallback((): boolean => {
    if (showSettings) {
      setShowSettings(false);
      return true;
    }
    if (drawerRef.current?.isOpen()) {
      drawerRef.current.close();
      return true;
    }
    if (screenHistory.length > 0) {
      const prev = screenHistory[screenHistory.length - 1];
      setScreenHistory((h) => h.slice(0, -1));
      setScreen(prev);
      return true;
    }
    if (screen !== "home") {
      setScreen("home");
      return true;
    }
    return false;
  }, [showSettings, screenHistory, screen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener(
      "hardwareBackPress",
      handleHardwareBack,
    );
    return () => sub.remove();
  }, [handleHardwareBack]);

  useEffect(() => {
    setApiClientBaseUrl(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (loading || !apiUrlNeedsSetup) return;
    void (async () => {
      if (await wasApiSetupPromptShown()) return;
      await markApiSetupPromptShown();
      Alert.alert(
        "PC API 주소 설정",
        "프리뷰 APK는 PC의 9ruDocs API 주소를 직접 입력해야 AI·WordPress 기능이 동작합니다.\n\n" +
          "1) PC에서 scripts\\start-api.bat 실행\n" +
          "2) cmd에서 ipconfig → Wi-Fi IPv4 확인\n" +
          "3) ⚙ 설정에 http://192.168.x.x:3001 입력 후 연결 테스트\n\n" +
          "폰·PC는 같은 Wi-Fi에 연결하세요.",
        [
          { text: "나중에", style: "cancel" },
          { text: "설정 열기", onPress: () => setShowSettings(true) },
        ],
      );
    })();
  }, [loading, apiUrlNeedsSetup]);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await loadDraftState();
        setDraftState(saved);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "초기화 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistState = useCallback(async (next: DraftListState) => {
    setDraftState(next);
    await saveDraftState(next);
  }, []);

  const updateDraft = useCallback(async (next: BlogDraft) => {
    const normalized =
      next.template === "restaurant" && next.restaurant
        ? {
            ...next,
            body: next.body || restaurantToMarkdown(next.restaurant),
          }
        : next;
    setDraftState((prev) => {
      const updated = upsertDraftInState(prev, normalized);
      void saveDraftState(updated);
      return updated;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (draft.steps.length === 0) {
      Alert.alert("단계 없음", "먼저 단계를 추가해 주세요.");
      return;
    }
    if (apiUrlNeedsSetup) {
      Alert.alert(
        "PC API 주소 설정 필요",
        "프리뷰 APK는 Expo Go와 달리 PC의 API 주소를 직접 설정해야 합니다.\n\n" +
          "1) PC에서 scripts\\start-api.bat 실행\n" +
          "2) ipconfig로 Wi-Fi IPv4 확인\n" +
          "3) ⚙ 설정에 http://192.168.x.x:3001 입력 후 연결 테스트\n\n" +
          "폰과 PC는 같은 Wi-Fi에 연결하세요.",
        [
          { text: "취소", style: "cancel" },
          { text: "설정 열기", onPress: () => setShowSettings(true) },
        ],
      );
      return;
    }
    setGenerating(true);
    try {
      const ai = draft.ai ?? {};
      const result = await generateBlog({
        steps: [...draft.steps]
          .sort((a, b) => a.order - b.order)
          .map((s) => ({
            caption: s.caption,
            order: s.order,
            location: s.location ?? undefined,
          })),
        tone: draft.tone ?? "friendly",
        persona: ai.persona?.trim() || undefined,
        target: ai.target?.trim() || undefined,
        keywords: ai.keywords?.trim() || undefined,
        toneLabel: ai.toneLabel?.trim() || undefined,
        personalTips: ai.personalTips?.trim() || undefined,
        cta: ai.cta?.trim() || undefined,
      });
      const next: BlogDraft = {
        ...draft,
        title: result.title,
        body: result.body,
        excerpt: result.excerpt,
        tags: result.suggestedTags ?? [],
        updatedAt: new Date().toISOString(),
      };
      await updateDraft(next);
      navigateTo("edit");
    } catch (e) {
      Alert.alert("AI 생성 실패", formatNetworkError(e));
    } finally {
      setGenerating(false);
    }
  }, [draft, updateDraft, apiUrlNeedsSetup, navigateTo]);

  const handleRestaurantGenerate = useCallback(async () => {
    const restaurant = normalizeRestaurantData(
      draft.restaurant ?? createEmptyRestaurantData(),
    );
    const hasInput =
      restaurant.restaurantName.trim().length > 0 ||
      restaurant.sections.some((s) => s.content.trim().length > 10);

    if (!hasInput) {
      Alert.alert("입력 필요", "맛집명 또는 섹션 내용을 먼저 입력해 주세요.");
      return;
    }
    if (apiUrlNeedsSetup) {
      Alert.alert(
        "PC API 주소 설정 필요",
        "⚙ 설정에서 PC API 주소를 입력한 뒤 AI 글쓰기를 사용해 주세요.",
        [
          { text: "취소", style: "cancel" },
          { text: "설정 열기", onPress: () => setShowSettings(true) },
        ],
      );
      return;
    }

    setGenerating(true);
    try {
      const result = await generateRestaurantBlog({
        restaurant,
        tone: draft.tone ?? "friendly",
      });
      const next: BlogDraft = {
        ...draft,
        title: result.title,
        body: result.body,
        excerpt: result.excerpt,
        tags: result.suggestedTags ?? [],
        restaurant,
        updatedAt: new Date().toISOString(),
      };
      await updateDraft(next);
      navigateTo("edit");
    } catch (e) {
      Alert.alert("AI 생성 실패", formatNetworkError(e));
    } finally {
      setGenerating(false);
    }
  }, [draft, updateDraft, apiUrlNeedsSetup, navigateTo]);

  const handleSelectDraft = useCallback(
    async (id: string) => {
      const next = switchActiveDraft(draftState, id);
      await persistState(next);
      resetToHome();
    },
    [draftState, persistState, resetToHome],
  );

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteChecked = useCallback(() => {
    if (checkedIds.size === 0) return;
    Alert.alert(
      "글 삭제",
      `선택한 ${checkedIds.size}개의 글을 삭제할까요?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            void (async () => {
              const next = removeDraftsFromState(draftState, checkedIds);
              await persistState(next);
              setCheckedIds(new Set());
              resetToHome();
            })();
          },
        },
      ],
    );
  }, [checkedIds, draftState, persistState, resetToHome]);

  const handleNewDraft = useCallback(async () => {
    const next = addNewDraftToState(draftState);
    await persistState(next);
    setCheckedIds(new Set());
    resetToHome();
    drawerRef.current?.close();
  }, [draftState, persistState, resetToHome]);

  const titles: Record<Screen, string> = {
    home: draft.template === "restaurant" ? "맛집 작성" : "단계 작성",
    edit: "글 편집",
    preview: "미리보기",
    publish: "WordPress",
  };

  const sdk = Constants.expoConfig?.sdkVersion ?? "?";

  if (bootError) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.bootErr}>시작 오류: {bootError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>9ruDocs</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {titles[screen]} · SDK {sdk}
            </Text>
            <Text style={styles.api} numberOfLines={1}>
              {apiBaseUrl}
            </Text>
          </View>
          <Pressable
            style={styles.gear}
            onPress={() => setShowSettings((v) => !v)}
          >
            <Text style={styles.gearText}>⚙</Text>
          </Pressable>
        </View>
      </View>

      {apiUrlNeedsSetup ? (
        <Pressable
          style={styles.apiBanner}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.apiBannerText}>
            ⚠ PC API 주소를 설정하세요 (⚙) — AI 생성에 필요
          </Text>
        </Pressable>
      ) : null}

      {showSettings ? (
        <SettingsScreen onClose={() => setShowSettings(false)} />
      ) : null}

      <View style={styles.main}>
        <DraftDrawer
          ref={drawerRef}
          drafts={draftState.drafts}
          activeId={draftState.activeId}
          checkedIds={checkedIds}
          onSelectDraft={(id) => void handleSelectDraft(id)}
          onToggleCheck={handleToggleCheck}
          onDeleteChecked={handleDeleteChecked}
          onNewDraft={() => void handleNewDraft()}
        >
        {screen === "home" && draft.template === "restaurant" && (
          <RestaurantTemplateScreen
            draft={draft}
            importing={importing}
            generating={generating}
            apiUrlNeedsSetup={apiUrlNeedsSetup}
            onChangeDraft={(d) => void updateDraft(d)}
            onImportStart={() => setImporting(true)}
            onImportEnd={() => setImporting(false)}
            onGenerate={() => void handleRestaurantGenerate()}
            onOpenSettings={() => setShowSettings(true)}
            onPreview={() => navigateTo("preview")}
            onPublish={() => navigateTo("publish")}
          />
        )}

        {screen === "home" && draft.template === "basic" && (
          <HomeScreen
            draft={draft}
            loading={loading}
            generating={generating}
            onChangeDraft={(d) => void updateDraft(d)}
            onGenerate={() => void handleGenerate()}
            onOpenPublish={() =>
              navigateTo(draft.body ? "publish" : "edit")
            }
          />
        )}

        {screen === "edit" && (
          <EditScreen
            draft={draft}
            onChangeDraft={(d) => void updateDraft(d)}
            onBack={() => {
              handleHardwareBack();
            }}
            onPreview={() => navigateTo("preview")}
            onPublish={() => navigateTo("publish")}
          />
        )}
        {screen === "preview" && (
          <BlogPreviewScreen
            draft={draft}
            onEdit={() => navigateTo("edit")}
            onPublish={() => navigateTo("publish")}
          />
        )}
        {screen === "publish" && (
          <PublishScreen
            draft={draft}
            onOpenSettings={() => setShowSettings(true)}
            onBack={() => {
              handleHardwareBack();
            }}
          />
        )}
        </DraftDrawer>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ApiProvider>
          <AppInner />
        </ApiProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc", paddingHorizontal: 16 },
  header: { paddingVertical: 8 },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  sub: { marginTop: 2, fontSize: 12, color: "#94a3b8" },
  api: { marginTop: 2, fontSize: 11, color: "#cbd5e1" },
  gear: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  gearText: { fontSize: 22 },
  apiBanner: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  apiBannerText: { fontSize: 13, fontWeight: "600", color: "#92400e" },
  bootErr: { color: "#b91c1c", padding: 16, fontSize: 16 },
  main: { flex: 1, position: "relative" },
});
