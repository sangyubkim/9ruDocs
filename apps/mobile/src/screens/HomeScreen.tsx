import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { BlogDraft, Step } from "../types";
import { createStep } from "../storage/draftStorage";

type Props = {
  draft: BlogDraft;
  loading: boolean;
  generating: boolean;
  onChangeDraft: (draft: BlogDraft) => void;
  onGenerate: () => void;
  onOpenPublish: () => void;
};

export function HomeScreen({
  draft,
  loading,
  generating,
  onChangeDraft,
  onGenerate,
  onOpenPublish,
}: Props) {
  const sorted = [...draft.steps].sort((a, b) => a.order - b.order);

  const persist = useCallback(
    (steps: Step[]) => {
      onChangeDraft({
        ...draft,
        steps,
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  const pickImage = useCallback(
    async (stepId: string, useCamera: boolean) => {
      if (useCamera) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert("권한 필요", "카메라 권한을 허용해 주세요.");
          return;
        }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          Alert.alert("권한 필요", "갤러리 권한을 허용해 주세요.");
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.8,
            allowsEditing: true,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });

      if (result.canceled || !result.assets[0]?.uri) return;

      const steps = draft.steps.map((s) =>
        s.id === stepId ? { ...s, imageUri: result.assets[0].uri } : s,
      );
      persist(steps);
    },
    [draft.steps, persist],
  );

  const addStep = useCallback(() => {
    const order = draft.steps.length;
    persist([...draft.steps, createStep(order)]);
  }, [draft.steps, persist]);

  const updateCaption = useCallback(
    (stepId: string, caption: string) => {
      persist(
        draft.steps.map((s) => (s.id === stepId ? { ...s, caption } : s)),
      );
    },
    [draft.steps, persist],
  );

  const removeStep = useCallback(
    (stepId: string) => {
      const next = draft.steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i }));
      persist(next);
    },
    [draft.steps, persist],
  );

  const captureNew = useCallback(async () => {
    const step = createStep(draft.steps.length);
    persist([...draft.steps, step]);
    await pickImage(step.id, true);
  }, [draft.steps, persist, pickImage]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>단계별 사진과 설명을 추가한 뒤 AI 글쓰기를 누르세요.</Text>

      <View style={styles.row}>
        <Pressable style={styles.primaryBtn} onPress={() => void captureNew()}>
          <Text style={styles.primaryBtnText}>캡처</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={addStep}>
          <Text style={styles.secondaryBtnText}>+ 단계 추가</Text>
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>아직 단계가 없습니다. 캡처로 시작하세요.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>단계 {index + 1}</Text>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.preview} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>이미지 없음</Text>
              </View>
            )}
            <View style={styles.imgRow}>
              <Pressable
                style={styles.smallBtn}
                onPress={() => void pickImage(item.id, true)}
              >
                <Text style={styles.smallBtnText}>카메라</Text>
              </Pressable>
              <Pressable
                style={styles.smallBtn}
                onPress={() => void pickImage(item.id, false)}
              >
                <Text style={styles.smallBtnText}>갤러리</Text>
              </Pressable>
              <Pressable
                style={styles.dangerBtn}
                onPress={() => removeStep(item.id)}
              >
                <Text style={styles.dangerBtnText}>삭제</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="이 단계 설명"
              multiline
              value={item.caption}
              onChangeText={(t) => updateCaption(item.id, t)}
            />
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, styles.full, generating && styles.disabled]}
          disabled={generating || sorted.length === 0}
          onPress={onGenerate}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>AI 글쓰기</Text>
          )}
        </Pressable>
        {draft.body ? (
          <Pressable style={styles.linkBtn} onPress={onOpenPublish}>
            <Text style={styles.linkBtnText}>WordPress 등록 →</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hint: { fontSize: 14, color: "#64748b", marginBottom: 12 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  list: { paddingBottom: 120 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  stepLabel: { fontWeight: "700", marginBottom: 8, color: "#0f172a" },
  preview: { width: "100%", height: 180, borderRadius: 8, backgroundColor: "#f1f5f9" },
  placeholder: {
    height: 120,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: "#94a3b8" },
  imgRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#e0e7ff",
    borderRadius: 8,
  },
  smallBtnText: { color: "#3730a3", fontWeight: "600", fontSize: 13 },
  dangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    marginLeft: "auto",
  },
  dangerBtnText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: 15,
  },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  full: { flex: 1 },
  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#334155", fontWeight: "600" },
  linkBtn: { marginTop: 10, alignItems: "center" },
  linkBtnText: { color: "#2563eb", fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
