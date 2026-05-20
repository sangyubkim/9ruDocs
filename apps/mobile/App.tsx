import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { formatNetworkError, generateBlog } from "./src/api/blog";
import { setApiClientBaseUrl } from "./src/api/client";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { ApiProvider, useApi } from "./src/context/ApiContext";
import {
  markApiSetupPromptShown,
  wasApiSetupPromptShown,
} from "./src/storage/settingsStorage";
import {
  createEmptyDraft,
  loadDraft,
  saveDraft,
} from "./src/storage/draftStorage";
import type { BlogDraft, Screen } from "./src/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { EditScreen } from "./src/screens/EditScreen";
import { BlogPreviewScreen } from "./src/screens/BlogPreviewScreen";
import { PublishScreen } from "./src/screens/PublishScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

function AppInner() {
  const { apiBaseUrl, apiUrlNeedsSetup } = useApi();
  const [screen, setScreen] = useState<Screen>("home");
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<BlogDraft>(createEmptyDraft());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

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
        const saved = await loadDraft();
        if (saved) setDraft(saved);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "초기화 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateDraft = useCallback(async (next: BlogDraft) => {
    setDraft(next);
    await saveDraft(next);
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
      setScreen("edit");
    } catch (e) {
      Alert.alert("AI 생성 실패", formatNetworkError(e));
    } finally {
      setGenerating(false);
    }
  }, [draft, updateDraft, apiUrlNeedsSetup]);

  const titles: Record<Screen, string> = {
    home: "단계 작성",
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

      {screen === "home" && (
        <HomeScreen
          draft={draft}
          loading={loading}
          generating={generating}
          onChangeDraft={(d) => void updateDraft(d)}
          onGenerate={() => void handleGenerate()}
          onOpenPublish={() => setScreen(draft.body ? "publish" : "edit")}
        />
      )}
      {screen === "edit" && (
        <EditScreen
          draft={draft}
          onChangeDraft={(d) => void updateDraft(d)}
          onBack={() => setScreen("home")}
          onPreview={() => setScreen("preview")}
          onPublish={() => setScreen("publish")}
        />
      )}
      {screen === "preview" && (
        <BlogPreviewScreen
          draft={draft}
          onEdit={() => setScreen("edit")}
          onPublish={() => setScreen("publish")}
        />
      )}
      {screen === "publish" && (
        <PublishScreen draft={draft} onBack={() => setScreen("edit")} />
      )}
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
});
