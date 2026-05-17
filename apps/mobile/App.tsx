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
import { generateBlog } from "./src/api/blog";
import { setApiClientBaseUrl } from "./src/api/client";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { ApiProvider, useApi } from "./src/context/ApiContext";
import {
  createEmptyDraft,
  loadDraft,
  saveDraft,
} from "./src/storage/draftStorage";
import type { BlogDraft, Screen } from "./src/types";
import { HomeScreen } from "./src/screens/HomeScreen";
import { EditScreen } from "./src/screens/EditScreen";
import { PublishScreen } from "./src/screens/PublishScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

function AppInner() {
  const { apiBaseUrl } = useApi();
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
    setGenerating(true);
    try {
      const result = await generateBlog({
        steps: [...draft.steps]
          .sort((a, b) => a.order - b.order)
          .map((s) => ({ caption: s.caption, order: s.order })),
        tone: "friendly",
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
      Alert.alert(
        "AI 생성 실패",
        e instanceof Error ? e.message : "설정에서 API 주소를 확인하세요.",
      );
    } finally {
      setGenerating(false);
    }
  }, [draft, updateDraft]);

  const titles: Record<Screen, string> = {
    home: "단계 작성",
    edit: "글 편집",
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
  bootErr: { color: "#b91c1c", padding: 16, fontSize: 16 },
});
