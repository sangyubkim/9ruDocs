import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  BlogDraft,
  MapProvider,
  RestaurantBasicInfo,
  RestaurantTemplateData,
  StepLocation,
} from "../types";
import { LocationMapPreview } from "../components/LocationMapPreview";
import { MapProviderRadio } from "../components/MapProviderRadio";
import { SectionInputCard } from "../components/SectionInputCard";
import { RestaurantSummaryCard } from "../components/RestaurantSummaryCard";
import { TemplatePicker } from "../components/TemplatePicker";
import { VoiceInputButton } from "../components/VoiceInputButton";
import { formatNetworkError } from "../api/blog";
import { importRestaurantBlog } from "../api/restaurant";
import {
  geocodePlaceName,
  locationFromCoords,
  locationFromPlaceName,
  refreshLocationProvider,
} from "../utils/maps";
import {
  RESTAURANT_SECTION_LABELS,
  addFoodReviewSection,
  canImportRestaurant,
  createEmptyRestaurantData,
  patchRestaurantSection,
  normalizeRestaurantData,
  patchSummary,
  removeFoodReviewSection,
  restaurantToMarkdown,
} from "../utils/restaurantTemplate";
import { parseSummaryContent } from "../utils/restaurantRatings";

type Props = {
  draft: BlogDraft;
  importing: boolean;
  generating: boolean;
  apiUrlNeedsSetup: boolean;
  onChangeDraft: (draft: BlogDraft) => void;
  onImportStart: () => void;
  onImportEnd: () => void;
  onGenerate: () => void;
  onOpenSettings: () => void;
  onPreview: () => void;
  onPublish: () => void;
};

function BasicInfoFields({
  data,
  onChange,
}: {
  data: RestaurantTemplateData;
  onChange: (patch: Partial<RestaurantTemplateData>) => void;
}) {
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const info = data.basicInfo;

  const patchInfo = (basicInfo: RestaurantBasicInfo) => {
    onChange({ basicInfo });
  };

  const setMapProvider = (mapProvider: MapProvider) => {
    onChange({
      mapProvider,
      location: refreshLocationProvider(data.location, mapProvider),
    });
  };

  const setLocation = (location: StepLocation | null) => {
    onChange({ location });
  };

  const geocodeAddress = useCallback(async () => {
    const query =
      [info.name, info.address, data.region].filter(Boolean).join(" ").trim() ||
      info.address.trim();
    if (!query) {
      Alert.alert("주소 입력", "상호명 또는 주소를 입력해 주세요.");
      return;
    }
    setGeocoding(true);
    try {
      const result = await geocodePlaceName(query);
      if (!result) {
        setLocation(
          locationFromPlaceName(query, data.mapProvider),
        );
        Alert.alert(
          "좌표 없음",
          "정확한 좌표는 찾지 못했지만 장소명으로 지도를 연결했습니다.",
        );
        return;
      }
      const label = info.name.trim() || result.label;
      if (info.address.trim() && !info.address.includes(result.label)) {
        patchInfo({ ...info, address: info.address.trim() || result.label });
      }
      setLocation(
        locationFromCoords(
          result.latitude,
          result.longitude,
          label,
          data.mapProvider,
        ),
      );
    } catch {
      Alert.alert("지도 연결 실패", "주소를 지도에 연결하지 못했습니다.");
    } finally {
      setGeocoding(false);
    }
  }, [data.mapProvider, data.region, info, setLocation]);

  const useCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("위치 권한 필요", "설정에서 위치 권한을 허용해 주세요.");
        return;
      }
      let pos = await Location.getLastKnownPositionAsync({
        maxAge: 60_000,
        requiredAccuracy: 500,
      });
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
      const { latitude, longitude } = pos.coords;
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      const label =
        info.name.trim() ||
        place?.name ||
        place?.street ||
        place?.city ||
        "현재 위치";
      const address =
        info.address.trim() ||
        [place?.region, place?.city, place?.street, place?.name]
          .filter(Boolean)
          .join(" ");
      if (address) patchInfo({ ...info, address });
      setLocation(
        locationFromCoords(latitude, longitude, label, data.mapProvider),
      );
    } catch {
      Alert.alert("위치 오류", "현재 위치를 가져오지 못했습니다.");
    } finally {
      setLocating(false);
    }
  }, [data.mapProvider, info, setLocation]);

  const otherFields: {
    key: keyof RestaurantBasicInfo;
    label: string;
    icon: string;
  }[] = [
    { key: "name", label: "상호명", icon: "📍" },
    { key: "hours", label: "영업시간", icon: "🕒" },
    { key: "phone", label: "전화번호", icon: "☎️" },
    { key: "parking", label: "주차", icon: "🚗" },
    { key: "reservation", label: "예약 가능 여부", icon: "💳" },
  ];

  return (
    <View style={styles.basicCard}>
      <Text style={styles.basicTitle}>2. 기본 정보</Text>

      <MapProviderRadio value={data.mapProvider} onChange={setMapProvider} />

      <View style={styles.basicRow}>
        <Text style={styles.basicLabel}>📍 주소</Text>
        <View style={styles.basicInputRow}>
          <TextInput
            style={styles.basicInput}
            value={info.address}
            onChangeText={(address) => patchInfo({ ...info, address })}
            placeholder="주소 입력"
          />
          <VoiceInputButton
            baseText={info.address}
            onResult={(address) => patchInfo({ ...info, address })}
          />
        </View>
        <View style={styles.locActions}>
          <Pressable
            style={[styles.locBtn, geocoding && styles.btnDisabled]}
            disabled={geocoding}
            onPress={() => void geocodeAddress()}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color="#0369a1" />
            ) : (
              <Text style={styles.locBtnText}>주소 → 지도</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.locBtn, locating && styles.btnDisabled]}
            disabled={locating}
            onPress={() => void useCurrentLocation()}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#0369a1" />
            ) : (
              <Text style={styles.locBtnText}>현재 위치</Text>
            )}
          </Pressable>
        </View>
      </View>

      {data.location ? (
        <LocationMapPreview
          location={data.location}
          mapService={data.mapProvider}
        />
      ) : null}

      {otherFields.map(({ key, label, icon }) => (
        <View key={key} style={styles.basicRow}>
          <Text style={styles.basicLabel}>
            {icon} {label}
          </Text>
          <View style={styles.basicInputRow}>
            <TextInput
              style={styles.basicInput}
              value={info[key]}
              onChangeText={(t) => patchInfo({ ...info, [key]: t })}
              placeholder={`${label} 입력`}
            />
            <VoiceInputButton
              baseText={info[key]}
              onResult={(t) => patchInfo({ ...info, [key]: t })}
            />
          </View>
        </View>
      ))}

      {data.location ? (
        <Pressable
          style={styles.clearLocBtn}
          onPress={() => setLocation(null)}
        >
          <Text style={styles.clearLocText}>지도 위치 제거</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RestaurantTemplateScreen({
  draft,
  importing,
  generating,
  apiUrlNeedsSetup,
  onChangeDraft,
  onImportStart,
  onImportEnd,
  onGenerate,
  onOpenSettings,
  onPreview,
  onPublish,
}: Props) {
  const insets = useSafeAreaInsets();
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const data = normalizeRestaurantData(
    draft.restaurant ?? createEmptyRestaurantData(),
  );

  const patchRestaurant = useCallback(
    (patch: Partial<RestaurantTemplateData>) => {
      const next: RestaurantTemplateData = { ...data, ...patch };
      const body = restaurantToMarkdown(next);
      onChangeDraft({
        ...draft,
        restaurant: next,
        title: draft.title || next.restaurantName,
        body,
        updatedAt: new Date().toISOString(),
      });
    },
    [data, draft, onChangeDraft],
  );

  const patchTitle = useCallback(
    (title: string) => {
      onChangeDraft({
        ...draft,
        title,
        restaurant: { ...data, restaurantName: title },
        updatedAt: new Date().toISOString(),
      });
    },
    [data, draft, onChangeDraft],
  );

  const handleTemplateChange = useCallback(
    (template: BlogDraft["template"]) => {
      if (template === "basic") {
        onChangeDraft({
          ...draft,
          template: "basic",
          updatedAt: new Date().toISOString(),
        });
        return;
      }
      onChangeDraft({
        ...draft,
        template: "restaurant",
        restaurant: draft.restaurant ?? createEmptyRestaurantData(),
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  const handleImport = useCallback(async () => {
    if (!canImportRestaurant(data)) {
      Alert.alert(
        "입력 필요",
        "가져오기를 위해 지역과 맛집명(제목) 2가지를 입력해 주세요.",
      );
      return;
    }
    if (apiUrlNeedsSetup) {
      Alert.alert("PC API 주소 설정 필요", "⚙ 설정에서 PC API 주소를 입력해 주세요.", [
        { text: "취소", style: "cancel" },
        { text: "설정 열기", onPress: onOpenSettings },
      ]);
      return;
    }

    onImportStart();
    try {
      const result = await importRestaurantBlog({
        region: data.region.trim(),
        restaurantName: data.restaurantName.trim() || draft.title.trim(),
        mainMenu: data.mainMenu.trim() || undefined,
      });

      let nextData = normalizeRestaurantData({
        region: result.region,
        restaurantName: result.restaurantName,
        mainMenu: result.mainMenu,
        mapProvider: data.mapProvider,
        location: data.location,
        basicInfo: result.basicInfo,
        sections: data.sections.map((s) => {
          const imported = result.sections[s.key];
          return imported ? { ...s, content: imported } : s;
        }),
        ratings: data.ratings,
        summaryHead: data.summaryHead,
        summaryTail: data.summaryTail,
      });

      const summaryImported = result.sections.summary;
      if (summaryImported) {
        const parsed = parseSummaryContent(summaryImported);
        Object.assign(nextData, {
          ratings: parsed.ratings,
          summaryHead: parsed.headText,
          summaryTail: parsed.tailText,
        });
        const summarySec = nextData.sections.find((s) => s.key === "summary");
        if (summarySec) summarySec.content = summaryImported;
      }

      const body = restaurantToMarkdown(nextData);
      onChangeDraft({
        ...draft,
        title: result.title,
        restaurant: nextData,
        body,
        excerpt: result.excerpt,
        tags: result.suggestedTags,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert(
        "가져오기 완료",
        result.importMeta?.message ??
          (result.sources && result.sources.length > 0
            ? `${result.sources.length}개 블로그를 참고해 내용을 채웠습니다. 필요한 부분을 수정해 주세요.`
            : "내용을 채웠습니다. 필요한 부분을 수정해 주세요."),
      );
    } catch (e) {
      Alert.alert("가져오기 실패", formatNetworkError(e));
    } finally {
      onImportEnd();
    }
  }, [
    apiUrlNeedsSetup,
    data,
    draft,
    onChangeDraft,
    onImportEnd,
    onImportStart,
    onOpenSettings,
  ]);

  const syncBody = useCallback(
    (nextData: RestaurantTemplateData) => {
      onChangeDraft({
        ...draft,
        restaurant: nextData,
        body: restaurantToMarkdown(nextData),
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <TextInput
            style={styles.titleInput}
            placeholder="맛집 제목"
            value={draft.title || data.restaurantName}
            onChangeText={patchTitle}
          />
          <VoiceInputButton
            baseText={draft.title || data.restaurantName}
            onResult={patchTitle}
          />
        </View>
        <View style={styles.topActions}>
          <Pressable
            style={[styles.importBtn, importing && styles.btnDisabled]}
            disabled={importing}
            onPress={() => void handleImport()}
          >
            {importing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.importBtnText}>가져오기</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.templateBtn}
            onPress={() => setShowTemplatePicker(true)}
          >
            <Text style={styles.templateBtnText}>템플릿 선택</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metaRow}>
        <TextInput
          style={styles.metaInput}
          placeholder="지역 (예: 강남)"
          value={data.region}
          onChangeText={(region) => patchRestaurant({ region })}
        />
        <TextInput
          style={styles.metaInput}
          placeholder="대표메뉴"
          value={data.mainMenu}
          onChangeText={(mainMenu) => patchRestaurant({ mainMenu })}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {(["intro", "atmosphere", "menu", "foodReview", "summary", "closing"] as const).map(
          (key) => {
            const sections =
              key === "foodReview"
                ? data.sections.filter((s) => s.key === key)
                : data.sections.filter((s) => s.key === key).slice(0, 1);
            const section = sections[0];
            if (!section) return null;

            if (key === "summary") {
              return (
                <RestaurantSummaryCard
                  key={section.id}
                  headText={data.summaryHead}
                  tailText={data.summaryTail}
                  ratings={data.ratings}
                  onChangeHead={(summaryHead) => {
                    syncBody(patchSummary(data, { summaryHead }));
                  }}
                  onChangeTail={(summaryTail) => {
                    syncBody(patchSummary(data, { summaryTail }));
                  }}
                  onChangeRatings={(ratings) => {
                    syncBody(patchSummary(data, { ratings }));
                  }}
                />
              );
            }

            if (key === "foodReview") {
              return (
                <View key="foodReview-list">
                  {sections.map((foodSection, index) => (
                    <SectionInputCard
                      key={foodSection.id}
                      label={`${RESTAURANT_SECTION_LABELS.foodReview} ${index + 1}`}
                      content={foodSection.content}
                      images={foodSection.images}
                      onChangeContent={(content) => {
                        syncBody(
                          patchRestaurantSection(data, foodSection.id, {
                            content,
                          }),
                        );
                      }}
                      onChangeImages={(images) => {
                        syncBody(
                          patchRestaurantSection(data, foodSection.id, {
                            images,
                          }),
                        );
                      }}
                      onRemove={() => {
                        syncBody(removeFoodReviewSection(data, foodSection.id));
                      }}
                    />
                  ))}
                  <Pressable
                    style={styles.addFoodReviewBtn}
                    onPress={() => syncBody(addFoodReviewSection(data))}
                  >
                    <Text style={styles.addFoodReviewText}>
                      + 음식 리뷰 추가
                    </Text>
                  </Pressable>
                </View>
              );
            }

            return (
              <View key={section.id}>
                <SectionInputCard
                  label={RESTAURANT_SECTION_LABELS[section.key]}
                  content={section.content}
                  images={section.images}
                  onChangeContent={(content) => {
                    syncBody(
                      patchRestaurantSection(data, section.id, { content }),
                    );
                  }}
                  onChangeImages={(images) => {
                    syncBody(
                      patchRestaurantSection(data, section.id, { images }),
                    );
                  }}
                />
                {key === "intro" ? (
                  <BasicInfoFields
                    data={data}
                    onChange={(patch) => {
                      syncBody({ ...data, ...patch });
                    }}
                  />
                ) : null}
              </View>
            );
          },
        )}

        <View style={styles.bottomActions}>
          <Pressable style={styles.previewBtn} onPress={onPreview}>
            <Text style={styles.previewBtnText}>미리보기</Text>
          </Pressable>
          {draft.body ? (
            <Pressable style={styles.publishBtn} onPress={onPublish}>
              <Text style={styles.publishBtnText}>WordPress 등록 →</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={[styles.aiBtn, (generating || importing) && styles.btnDisabled]}
          disabled={generating || importing}
          onPress={onGenerate}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.aiBtnText}>AI 글쓰기</Text>
          )}
        </Pressable>
      </View>

      <TemplatePicker
        visible={showTemplatePicker}
        current="restaurant"
        onSelect={handleTemplateChange}
        onClose={() => setShowTemplatePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: { marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  titleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingVertical: 8,
  },
  topActions: { flexDirection: "row", gap: 8 },
  importBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 11,
    borderRadius: 20,
    alignItems: "center",
  },
  importBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  templateBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#2563eb",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  templateBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  metaInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  scroll: { flex: 1 },
  basicCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  basicTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  basicRow: { marginBottom: 10 },
  basicLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 4 },
  basicInputRow: { flexDirection: "row", alignItems: "center" },
  basicInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  locActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  locBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
  },
  locBtnText: { color: "#0369a1", fontWeight: "600", fontSize: 13 },
  clearLocBtn: { marginTop: 8, alignSelf: "flex-start" },
  clearLocText: { color: "#64748b", fontSize: 13 },
  addFoodReviewBtn: {
    marginBottom: 12,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
    alignItems: "center",
  },
  addFoodReviewText: { color: "#2563eb", fontWeight: "800", fontSize: 15 },
  bottomActions: { gap: 10, marginTop: 4, marginBottom: 20 },
  previewBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  previewBtnText: { color: "#334155", fontWeight: "700" },
  publishBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  publishBtnText: { color: "#fff", fontWeight: "700" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  aiBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  aiBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
