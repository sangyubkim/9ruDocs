import { useCallback, useRef, useState } from "react";
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
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BlogDraft, Step, StepLocation } from "../types";
import { createStep } from "../storage/draftStorage";
import { VoiceInputButton } from "../components/VoiceInputButton";
import { LocationMapPreview } from "../components/LocationMapPreview";
import {
  geocodePlaceName,
  locationFromCoords,
} from "../utils/maps";

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
  const insets = useSafeAreaInsets();
  const [placeDrafts, setPlaceDrafts] = useState<Record<string, string>>({});
  const [geocodingStepId, setGeocodingStepId] = useState<string | null>(null);
  const [locatingStepId, setLocatingStepId] = useState<string | null>(null);
  const locatingRef = useRef(false);
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

  const updateStep = useCallback(
    (stepId: string, patch: Partial<Step>) => {
      persist(
        draft.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      );
    },
    [draft.steps, persist],
  );

  const pickImage = useCallback(
    async (stepId: string, useCamera: boolean) => {
      const step = draft.steps.find((s) => s.id === stepId);
      if (step?.status === "completed") return;

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
            mediaTypes: ["images"],
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
      updateStep(stepId, { caption });
    },
    [updateStep],
  );

  const removeStep = useCallback(
    (stepId: string) => {
      const next = draft.steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i }));
      persist(next);
      setPlaceDrafts((prev) => {
        const copy = { ...prev };
        delete copy[stepId];
        return copy;
      });
    },
    [draft.steps, persist],
  );

  const completeStep = useCallback(
    (stepId: string) => {
      updateStep(stepId, { status: "completed" });
    },
    [updateStep],
  );

  const editStep = useCallback(
    (stepId: string) => {
      updateStep(stepId, { status: "editing" });
    },
    [updateStep],
  );

  const setLocation = useCallback(
    (stepId: string, location: StepLocation | null) => {
      updateStep(stepId, { location });
    },
    [updateStep],
  );

  const useCurrentLocation = useCallback(
    async (stepId: string) => {
      if (locatingRef.current) return;
      locatingRef.current = true;
      setLocatingStepId(stepId);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "위치 권한 필요",
            "설정 → 앱 → 9ruDocs → 위치를 「앱 사용 중」으로 허용한 뒤 다시 시도해 주세요.",
          );
          return;
        }

        let pos = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 500,
        });
        if (!pos) {
          pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 25_000,
          });
        }
        const { latitude, longitude } = pos.coords;
        const [place] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        const label =
          place?.name ?? place?.street ?? place?.city ?? "현재 위치";
        setLocation(
          stepId,
          locationFromCoords(latitude, longitude, label || "현재 위치"),
        );
        Alert.alert(
          "위치 저장됨",
          `${label || "현재 위치"}\n${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        );
      } catch {
        Alert.alert(
          "위치 오류",
          "GPS 신호가 약하거나 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        locatingRef.current = false;
        setLocatingStepId(null);
      }
    },
    [setLocation],
  );

  const applyPlaceSearch = useCallback(
    async (stepId: string) => {
      const query = (placeDrafts[stepId] ?? "").trim();
      if (!query) {
        Alert.alert("장소 입력", "검색할 장소 이름을 입력해 주세요.");
        return;
      }

      setGeocodingStepId(stepId);
      try {
        const result = await geocodePlaceName(query);
        if (!result) {
          Alert.alert(
            "장소 검색 실패",
            "장소를 찾지 못했습니다. 이름을 바꿔 보거나 「현재 위치」를 사용해 주세요.",
          );
          return;
        }
        setLocation(
          stepId,
          locationFromCoords(result.latitude, result.longitude, result.label),
        );
      } catch {
        Alert.alert("장소 검색 오류", "좌표를 가져오지 못했습니다.");
      } finally {
        setGeocodingStepId(null);
      }
    },
    [placeDrafts, setLocation],
  );

  const captureNew = useCallback(async () => {
    const step = createStep(draft.steps.length);
    persist([...draft.steps, step]);
    await pickImage(step.id, true);
  }, [draft.steps, persist, pickImage]);

  const footerPad = Math.max(insets.bottom, 12);
  const listPad = 140 + insets.bottom;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>
        단계별 사진·설명·위치를 추가한 뒤 작성완료로 잠그고 AI 글쓰기를 누르세요.
      </Text>

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
        contentContainerStyle={[styles.list, { paddingBottom: listPad }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>아직 단계가 없습니다. 캡처로 시작하세요.</Text>
        }
        renderItem={({ item, index }) => {
          const locked = item.status === "completed";
          const placeQuery = placeDrafts[item.id] ?? item.location?.label ?? "";

          return (
            <View style={[styles.card, locked && styles.cardLocked]}>
              <View style={styles.cardHeader}>
                <Text style={styles.stepLabel}>단계 {index + 1}</Text>
                {locked ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>작성완료</Text>
                  </View>
                ) : null}
              </View>

              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.preview} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>이미지 없음</Text>
                </View>
              )}

              <View style={styles.imgRow}>
                <Pressable
                  style={[styles.smallBtn, locked && styles.disabledBtn]}
                  disabled={locked}
                  onPress={() => void pickImage(item.id, true)}
                >
                  <Text style={styles.smallBtnText}>카메라</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallBtn, locked && styles.disabledBtn]}
                  disabled={locked}
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

              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputFlex,
                    locked && styles.inputLocked,
                  ]}
                  placeholder="이 단계 설명"
                  multiline
                  editable={!locked}
                  value={item.caption}
                  onChangeText={(t) => updateCaption(item.id, t)}
                />
                {!locked ? (
                  <VoiceInputButton
                    baseText={item.caption}
                    onResult={(t) => updateCaption(item.id, t)}
                  />
                ) : null}
              </View>

              <Text style={styles.locTitle}>위치 · 구글 지도 (선택)</Text>
              {item.location ? (
                <View>
                  <LocationMapPreview location={item.location} />
                  {!locked ? (
                    <Pressable
                      style={styles.clearLocBtn}
                      onPress={() => setLocation(item.id, null)}
                    >
                      <Text style={styles.clearLocText}>위치 제거</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {!locked ? (
                <View style={styles.locActions}>
                  <Pressable
                    style={[
                      styles.locBtn,
                      locatingStepId === item.id && styles.disabledBtn,
                    ]}
                    disabled={locatingStepId === item.id}
                    onPress={() => void useCurrentLocation(item.id)}
                  >
                    {locatingStepId === item.id ? (
                      <>
                        <ActivityIndicator size="small" color="#0369a1" />
                        <Text style={styles.locBtnText}>위치 찾는 중…</Text>
                      </>
                    ) : (
                      <Text style={styles.locBtnText}>현재 위치</Text>
                    )}
                  </Pressable>
                  <TextInput
                    style={styles.placeInput}
                    placeholder="장소 이름 (예: 강남역)"
                    value={placeQuery}
                    onChangeText={(t) =>
                      setPlaceDrafts((prev) => ({ ...prev, [item.id]: t }))
                    }
                  />
                  <Pressable
                    style={[
                      styles.locBtn,
                      geocodingStepId === item.id && styles.disabledBtn,
                    ]}
                    disabled={geocodingStepId === item.id}
                    onPress={() => void applyPlaceSearch(item.id)}
                  >
                    {geocodingStepId === item.id ? (
                      <ActivityIndicator size="small" color="#0369a1" />
                    ) : (
                      <Text style={styles.locBtnText}>장소 저장</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.stepActions}>
                {locked ? (
                  <Pressable
                    style={styles.editStepBtn}
                    onPress={() => editStep(item.id)}
                  >
                    <Text style={styles.editStepBtnText}>수정</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.doneStepBtn}
                    onPress={() => completeStep(item.id)}
                  >
                    <Text style={styles.doneStepBtnText}>작성완료</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: footerPad }]}>
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
  list: {},
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardLocked: { backgroundColor: "#f8fafc", opacity: 0.98 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  stepLabel: { fontWeight: "700", color: "#0f172a" },
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
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
  disabledBtn: { opacity: 0.45 },
  dangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    marginLeft: "auto",
  },
  dangerBtnText: { color: "#b91c1c", fontWeight: "600", fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: 15,
    backgroundColor: "#fff",
  },
  inputFlex: { flex: 1 },
  inputLocked: { backgroundColor: "#f1f5f9", color: "#475569" },
  locTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  clearLocBtn: { marginTop: 6, alignSelf: "flex-start" },
  clearLocText: { color: "#64748b", fontSize: 13 },
  locActions: { marginTop: 8, gap: 8 },
  locBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
  },
  locBtnText: { color: "#0369a1", fontWeight: "600", fontSize: 13 },
  placeInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  stepActions: { marginTop: 12, alignItems: "flex-end" },
  doneStepBtn: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  doneStepBtnText: { color: "#fff", fontWeight: "700" },
  editStepBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editStepBtnText: { color: "#334155", fontWeight: "700" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 40 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 0,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  full: {},
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
