import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { BlogDraft } from "../types";
import { publishToWordPress } from "../api/wordpress";
import { imageUriToBase64 } from "../utils/imageBase64";

type Props = {
  draft: BlogDraft;
  onBack: () => void;
};

export function PublishScreen({ draft, onBack }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{
    link: string;
    postId: number;
    featuredMediaId: number | null;
  } | null>(null);

  const publish = async (asDraft: boolean) => {
    setPublishing(true);
    try {
      const images = [];
      for (const step of draft.steps) {
        if (!step.imageUri) continue;
        images.push(await imageUriToBase64(step.imageUri));
      }

      const res = await publishToWordPress({
        title: draft.title,
        content: draft.body,
        excerpt: draft.excerpt,
        status: asDraft ? "draft" : "publish",
        tags: draft.tags,
        images,
        seo: {
          metaDescription: draft.excerpt,
          yoastTitle: draft.title,
          yoastDescription: draft.excerpt,
        },
      });

      setResult({
        link: res.link,
        postId: res.postId,
        featuredMediaId: res.featuredMediaId,
      });
    } catch (e) {
      Alert.alert(
        "게시 실패",
        e instanceof Error ? e.message : "알 수 없는 오류",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.title}>WordPress 등록</Text>
      <Text style={styles.meta}>
        설정(⚙)에 저장한 WordPress 자격 증명을 사용합니다. 앱에 없으면 서버
        .env(WP_SITE_URL / WP_USERNAME / WP_APP_PASSWORD)로 대체됩니다.
        {"\n"}
        애플리케이션 비밀번호 사용을 권장하며, 저장된 값은 이 기기에만
        보관됩니다.
      </Text>

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>제목: {draft.title || "(없음)"}</Text>
        <Text style={styles.summaryLine}>태그: {draft.tags.join(", ") || "(없음)"}</Text>
        <Text style={styles.summaryLine}>
          이미지: {draft.steps.filter((s) => s.imageUri).length}장 → featured + 본문
        </Text>
      </View>

      {result ? (
        <View style={styles.result}>
          <Text style={styles.ok}>게시 완료 (ID: {result.postId})</Text>
          {result.featuredMediaId ? (
            <Text style={styles.sub}>대표 이미지 ID: {result.featuredMediaId}</Text>
          ) : null}
          <Pressable onPress={() => void Linking.openURL(result.link)}>
            <Text style={styles.link}>{result.link}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.draft, publishing && styles.disabled]}
          disabled={publishing}
          onPress={() => void publish(true)}
        >
          {publishing ? (
            <ActivityIndicator color="#334155" />
          ) : (
            <Text style={styles.draftText}>초안 저장</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.btn, styles.publish, publishing && styles.disabled]}
          disabled={publishing}
          onPress={() => void publish(false)}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.publishText}>바로 게시</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.back} onPress={onBack}>
        <Text style={styles.backText}>← 편집으로</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  meta: { marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 20 },
  summary: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  summaryLine: { fontSize: 14, color: "#334155" },
  result: {
    marginTop: 16,
    padding: 14,
    backgroundColor: "#ecfdf5",
    borderRadius: 10,
  },
  ok: { fontWeight: "700", color: "#15803d" },
  sub: { marginTop: 4, fontSize: 13, color: "#166534" },
  link: { marginTop: 8, color: "#2563eb", textDecorationLine: "underline" },
  row: { flexDirection: "row", gap: 8, marginTop: 20 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  draft: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1" },
  draftText: { fontWeight: "700", color: "#334155" },
  publish: { backgroundColor: "#16a34a" },
  publishText: { fontWeight: "700", color: "#fff" },
  back: { marginTop: 16, alignItems: "center" },
  backText: { color: "#2563eb", fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
