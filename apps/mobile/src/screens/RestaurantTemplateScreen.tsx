import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { pickImage } from "../utils/imagePicker";
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
import { PrefixedFieldInput } from "../components/PrefixedFieldInput";
import { BlogImportModal } from "../components/BlogImportModal";
import { TemplatePicker } from "../components/TemplatePicker";
import { VoiceInputButton } from "../components/VoiceInputButton";
import type { RestaurantImportResponse } from "../api/restaurant";
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
  effectiveRestaurantFields,
  getIntroExcerpt,
  initRestaurantTemplateData,
  patchRestaurantSection,
  normalizeRestaurantData,
  patchSummary,
  removeFoodReviewSection,
  restaurantToMarkdown,
  RESTAURANT_FIELD_PREFIXES,
  sanitizeRestaurantFieldValue,
  validateRestaurantIntro,
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

  const isVagueAddress = (raw) => {
    const addressRaw = String(raw ?? "").trim();
    return (
      !addressRaw ||
      /방문\s*(?:전|후)\s*확인|참고|블로그/i.test(addressRaw) ||
      addressRaw.length < 6
    );
  };

  const geocodeByQuery = useCallback(
    async (query: string, fillAddressIfEmpty: boolean) => {
      if (!query.trim()) {
        Alert.alert("주소 입력", "상호명 또는 주소를 입력해 주세요.");
        return;
      }
      setGeocoding(true);
      try {
        const result = await geocodePlaceName(query);
        if (!result) {
          setLocation(locationFromPlaceName(query, data.mapProvider));
          Alert.alert(
            "좌표 없음",
            "정확한 좌표는 찾지 못했지만 장소명으로 지도를 연결했습니다.",
          );
          return;
        }
        const placeName =
          info.name.trim() || data.restaurantName.trim() || result.label;
        if (fillAddressIfEmpty && isVagueAddress(info.address)) {
          patchInfo({ ...info, address: result.label });
        }
        setLocation(
          locationFromCoords(
            result.latitude,
            result.longitude,
            placeName,
            data.mapProvider,
          ),
        );
      } catch {
        Alert.alert("지도 연결 실패", "주소를 지도에 연결하지 못했습니다.");
      } finally {
        setGeocoding(false);
      }
    },
    [data.mapProvider, data.restaurantName, info, setLocation],
  );

  /** 상호명(+지역)으로 검색 — 주소가 비었을 때 */
  const geocodeByName = useCallback(async () => {
    const placeName = info.name.trim() || data.restaurantName.trim() || "";
    const query = [placeName, data.region].filter(Boolean).join(" ").trim();
    if (!query) {
      Alert.alert("가게명 입력", "상호명 또는 맛집명을 입력해 주세요.");
      return;
    }
    await geocodeByQuery(query, true);
  }, [data.region, data.restaurantName, geocodeByQuery, info.name]);

  /** 직접 입력한 주소로 검색 */
  const geocodeByAddress = useCallback(async () => {
    const addressRaw = info.address.trim();
    if (isVagueAddress(addressRaw)) {
      Alert.alert(
        "주소 입력",
        "주소를 직접 입력한 뒤 「주소로 검색」을 눌러 주세요.",
      );
      return;
    }
    const placeName = info.name.trim() || data.restaurantName.trim() || "";
    const query = [placeName, addressRaw, data.region]
      .filter(Boolean)
      .join(" ")
      .trim();
    await geocodeByQuery(query, false);
  }, [
    data.region,
    data.restaurantName,
    geocodeByQuery,
    info.address,
    info.name,
  ]);

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
            placeholder="주소를 직접 입력하거나 가게명으로 검색"
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
            onPress={() => void geocodeByName()}
          >
            {geocoding ? (
              <ActivityIndicator size="small" color="#0369a1" />
            ) : (
              <Text style={styles.locBtnText}>가게명으로 검색</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.locBtn, geocoding && styles.btnDisabled]}
            disabled={geocoding}
            onPress={() => void geocodeByAddress()}
          >
            <Text style={styles.locBtnText}>주소로 검색</Text>
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
          {key === "parking" ? (
            <ParkingImagesRow
              images={data.parkingImages ?? []}
              onChange={(parkingImages) => onChange({ parkingImages })}
            />
          ) : null}
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

/** 주차 필드 아래 사진 첨부 (섹션 이미지 패턴 재사용) */
function ParkingImagesRow({
  images,
  onChange,
}: {
  images: string[];
  onChange: (uris: string[]) => void;
}) {
  const addImage = async (useCamera: boolean) => {
    const uri = await pickImage(useCamera);
    if (uri) onChange([...images, uri]);
  };

  return (
    <View style={styles.parkingImages}>
      {images.length > 0 ? (
        <View style={styles.parkingImageGrid}>
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.parkingImageWrap}>
              <Image source={{ uri }} style={styles.parkingThumb} />
              <Pressable
                style={styles.parkingImageDel}
                onPress={() => onChange(images.filter((_, idx) => idx !== i))}
              >
                <Text style={styles.parkingImageDelText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.parkingToolRow}>
        <Pressable style={styles.parkingToolBtn} onPress={() => void addImage(true)}>
          <Text style={styles.parkingToolBtnText}>📷 주차 사진</Text>
        </Pressable>
        <Pressable style={styles.parkingToolBtn} onPress={() => void addImage(false)}>
          <Text style={styles.parkingToolBtnText}>🖼 갤러리</Text>
        </Pressable>
      </View>
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
  const [showBlogImport, setShowBlogImport] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const data = normalizeRestaurantData(
    draft.restaurant ?? createEmptyRestaurantData(),
  );
  /** 연속 입력 시 stale draft/data로 섹션이 덮이지 않도록 최신 restaurant 유지 */
  const restaurantRef = useRef(data);
  restaurantRef.current = data;

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!showBlogImport && !showTemplatePicker) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showBlogImport) {
        setShowBlogImport(false);
        return true;
      }
      if (showTemplatePicker) {
        setShowTemplatePicker(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [showBlogImport, showTemplatePicker]);

  const patchRestaurant = useCallback(
    (patch: Partial<RestaurantTemplateData>) => {
      const next: RestaurantTemplateData = {
        ...restaurantRef.current,
        ...patch,
      };
      restaurantRef.current = next;
      const body = restaurantToMarkdown(next);
      onChangeDraft({
        ...draft,
        restaurant: next,
        title: draft.title || next.restaurantName,
        body,
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  const patchTitle = useCallback(
    (title: string) => {
      const clean = sanitizeRestaurantFieldValue(title, "restaurantName");
      const nextRestaurant = { ...restaurantRef.current, restaurantName: clean };
      restaurantRef.current = nextRestaurant;
      onChangeDraft({
        ...draft,
        title: clean,
        restaurant: nextRestaurant,
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  const titleValue = sanitizeRestaurantFieldValue(
    draft.title || data.restaurantName,
    "restaurantName",
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
      const restaurant = initRestaurantTemplateData(draft.restaurant, draft.title);
      onChangeDraft({
        ...draft,
        template: "restaurant",
        title: draft.title.trim() || restaurant.restaurantName,
        restaurant,
        body: restaurantToMarkdown(restaurant),
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  const applyImportResult = useCallback(
    async (result: RestaurantImportResponse) => {
      let nextData = normalizeRestaurantData({
        region: result.region,
        restaurantName: result.restaurantName,
        mainMenu: result.mainMenu,
        mapProvider: data.mapProvider,
        location: data.location,
        basicInfo: result.basicInfo,
        parkingImages: data.parkingImages,
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

      const geocodeQuery =
        result.geocodeHint?.geocodeQuery ||
        [result.basicInfo.name, result.basicInfo.address, result.region]
          .filter(Boolean)
          .join(" ")
          .trim();

      if (geocodeQuery) {
        try {
          const geo = await geocodePlaceName(geocodeQuery);
          const label =
            result.basicInfo.name.trim() ||
            result.geocodeHint?.address ||
            geocodeQuery;
          if (geo) {
            nextData = {
              ...nextData,
              location: locationFromCoords(
                geo.latitude,
                geo.longitude,
                label,
                nextData.mapProvider,
              ),
            };
          } else {
            nextData = {
              ...nextData,
              location: locationFromPlaceName(label, nextData.mapProvider),
            };
          }
        } catch {
          /* 지도 연결 실패 시 주소만 유지 */
        }
      }

      const body = restaurantToMarkdown(nextData);
      onChangeDraft({
        ...draft,
        title: result.title,
        restaurant: nextData,
        body,
        excerpt: getIntroExcerpt(nextData) || result.excerpt,
        tags: result.suggestedTags,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert(
        "가져오기 완료",
        result.importMeta?.message ??
          (result.sources && result.sources.length > 0
            ? `선택한 블로그를 참고해 내용을 채웠습니다. 지도와 주소를 확인해 주세요.`
            : "내용을 채웠습니다. 필요한 부분을 수정해 주세요."),
      );
    },
    [data, draft, onChangeDraft],
  );

  const handleImport = useCallback(() => {
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
    setShowBlogImport(true);
    onImportStart();
  }, [apiUrlNeedsSetup, data, onImportStart, onOpenSettings]);

  const syncBody = useCallback(
    (nextData: RestaurantTemplateData) => {
      restaurantRef.current = nextData;
      onChangeDraft({
        ...draft,
        restaurant: nextData,
        body: restaurantToMarkdown(nextData),
        excerpt: getIntroExcerpt(nextData),
        updatedAt: new Date().toISOString(),
      });
    },
    [draft, onChangeDraft],
  );

  const ensureIntroReady = useCallback((): boolean => {
    const check = validateRestaurantIntro(restaurantRef.current);
    if (!check.ok) {
      Alert.alert("도입부 확인", check.message ?? "도입부를 확인해 주세요.");
      return false;
    }
    return true;
  }, []);

  const footerPad = Math.max(insets.bottom, 20) + 8;
  const scrollBottomPad = keyboardVisible
    ? 48 + insets.bottom
    : 120 + footerPad + insets.bottom;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <PrefixedFieldInput
            prefix={RESTAURANT_FIELD_PREFIXES.restaurantName}
            placeholder="맛집명 입력"
            large
            containerStyle={styles.titlePrefixed}
            style={styles.titleInput}
            value={titleValue}
            onChangeText={patchTitle}
          />
          <VoiceInputButton
            baseText={titleValue}
            onResult={patchTitle}
          />
        </View>
        <View style={styles.topActions}>
          <Pressable
            style={[styles.importBtn, importing && styles.btnDisabled]}
            disabled={importing}
            onPress={handleImport}
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
        <PrefixedFieldInput
          prefix={RESTAURANT_FIELD_PREFIXES.region}
          placeholder="예: 강남"
          containerStyle={styles.metaInputWrap}
          style={styles.metaInputInner}
          value={data.region}
          onChangeText={(region) =>
            patchRestaurant({
              region: sanitizeRestaurantFieldValue(region, "region"),
            })
          }
        />
        <PrefixedFieldInput
          prefix={RESTAURANT_FIELD_PREFIXES.mainMenu}
          placeholder="예: 삼겹살"
          containerStyle={styles.metaInputWrap}
          style={styles.metaInputInner}
          value={data.mainMenu}
          onChangeText={(mainMenu) =>
            patchRestaurant({
              mainMenu: sanitizeRestaurantFieldValue(mainMenu, "mainMenu"),
            })
          }
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: scrollBottomPad }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
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
                    syncBody(patchSummary(restaurantRef.current, { summaryHead }));
                  }}
                  onChangeTail={(summaryTail) => {
                    syncBody(patchSummary(restaurantRef.current, { summaryTail }));
                  }}
                  onChangeRatings={(ratings) => {
                    syncBody(patchSummary(restaurantRef.current, { ratings }));
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
                          patchRestaurantSection(restaurantRef.current, foodSection.id, {
                            content,
                          }),
                        );
                      }}
                      onChangeImages={(images) => {
                        syncBody(
                          patchRestaurantSection(restaurantRef.current, foodSection.id, {
                            images,
                          }),
                        );
                      }}
                      onRemove={() => {
                        syncBody(removeFoodReviewSection(restaurantRef.current, foodSection.id));
                      }}
                    />
                  ))}
                  <Pressable
                    style={styles.addFoodReviewBtn}
                    onPress={() => syncBody(addFoodReviewSection(restaurantRef.current))}
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
                  requireImage={key === "intro"}
                  onChangeContent={(content) => {
                    syncBody(
                      patchRestaurantSection(restaurantRef.current, section.id, {
                        content,
                      }),
                    );
                  }}
                  onChangeImages={(images) => {
                    syncBody(
                      patchRestaurantSection(restaurantRef.current, section.id, {
                        images,
                      }),
                    );
                  }}
                />
                {key === "intro" ? (
                  <BasicInfoFields
                    data={data}
                    onChange={(patch) => {
                      syncBody({ ...restaurantRef.current, ...patch });
                    }}
                  />
                ) : null}
              </View>
            );
          },
        )}

        <View style={styles.bottomActions}>
          <Pressable
            style={styles.previewBtn}
            onPress={() => {
              syncBody(restaurantRef.current);
              if (!ensureIntroReady()) return;
              onPreview();
            }}
          >
            <Text style={styles.previewBtnText}>미리보기</Text>
          </Pressable>
          {draft.body ? (
            <Pressable
              style={styles.publishBtn}
              onPress={() => {
                syncBody(restaurantRef.current);
                if (!ensureIntroReady()) return;
                onPublish();
              }}
            >
              <Text style={styles.publishBtnText}>WordPress 등록 →</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* 키보드가 올라오면 절대 footer를 숨겨 입력칸이 가려지지 않게 함 */}
      {!keyboardVisible ? (
        <View style={[styles.footer, { paddingBottom: footerPad }]}>
          <Pressable
            style={[
              styles.aiBtn,
              (generating || importing) && styles.btnDisabled,
            ]}
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
      ) : null}

      <TemplatePicker
        visible={showTemplatePicker}
        current="restaurant"
        onSelect={handleTemplateChange}
        onClose={() => setShowTemplatePicker(false)}
      />

      <BlogImportModal
        visible={showBlogImport}
        payload={
          showBlogImport
            ? {
                region: effectiveRestaurantFields(data).region,
                restaurantName:
                  effectiveRestaurantFields(data).restaurantName ||
                  sanitizeRestaurantFieldValue(draft.title, "restaurantName"),
                mainMenu: effectiveRestaurantFields(data).mainMenu || undefined,
              }
            : null
        }
        onClose={() => {
          setShowBlogImport(false);
          onImportEnd();
        }}
        onApplied={applyImportResult}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: { marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  titlePrefixed: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingVertical: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
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
  metaInputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  metaInputInner: { fontSize: 14 },
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
  locActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  locBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
  },
  locBtnText: { color: "#0369a1", fontWeight: "600", fontSize: 13 },
  clearLocBtn: { marginTop: 8, alignSelf: "flex-start" },
  clearLocText: { color: "#64748b", fontSize: 13 },
  parkingImages: { marginTop: 8 },
  parkingImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  parkingImageWrap: { position: "relative" },
  parkingThumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  parkingImageDel: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  parkingImageDelText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  parkingToolRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  parkingToolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#e0e7ff",
    borderRadius: 8,
  },
  parkingToolBtnText: { fontSize: 12, fontWeight: "600", color: "#3730a3" },
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
