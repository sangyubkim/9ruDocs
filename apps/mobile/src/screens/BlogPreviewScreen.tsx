import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LocationMapPreview } from "../components/LocationMapPreview";
import type { BlogDraft, Step } from "../types";
import {
  normalizeRestaurantData,
  restaurantToMarkdown,
  getIntroExcerpt,
  getIntroFeaturedImageUri,
  validateRestaurantIntro,
} from "../utils/restaurantTemplate";
import { locationFromPlaceName } from "../utils/maps";
import { MarkdownPreviewBody } from "../utils/markdownPreview";

type Props = {
  draft: BlogDraft;
  onEdit: () => void;
  onPublish: () => void;
};

function sortedSteps(steps: Step[]): Step[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

export function BlogPreviewScreen({ draft, onEdit, onPublish }: Props) {
  const steps = sortedSteps(draft.steps);
  const restaurant =
    draft.template === "restaurant" && draft.restaurant
      ? normalizeRestaurantData(draft.restaurant)
      : null;
  const featured =
    (restaurant ? getIntroFeaturedImageUri(restaurant) : null) ??
    steps.find((s) => s.imageUri)?.imageUri ??
    null;
  const excerptText = restaurant
    ? getIntroExcerpt(restaurant)
    : draft.excerpt.trim();
  const stepsWithImages = steps.filter((s) => s.imageUri);
  const stepsWithLocation = steps.filter(
    (s) => s.location?.label || s.location?.mapsUrl,
  );

  const restaurantLocation =
    restaurant?.location ??
    (restaurant?.basicInfo.address.trim()
      ? locationFromPlaceName(
          [restaurant.basicInfo.name, restaurant.basicInfo.address]
            .filter(Boolean)
            .join(" "),
          restaurant.mapProvider,
        )
      : null);
  const showRestaurantMap =
    draft.template === "restaurant" &&
    restaurantLocation &&
    (restaurantLocation.mapsUrl ||
      restaurantLocation.label ||
      restaurantLocation.latitude != null);
  // 기존 draft.body에 ## 도입부 / # 상호 가 남아 있어도 restaurant에서 재생성
  const previewBody = restaurant
    ? restaurantToMarkdown(restaurant)
    : draft.body;

  const handlePublish = () => {
    if (restaurant) {
      const check = validateRestaurantIntro(restaurant);
      if (!check.ok) {
        Alert.alert("도입부 확인", check.message ?? "도입부를 확인해 주세요.");
        return;
      }
    }
    onPublish();
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.badge}>발행 미리보기</Text>
      <Text style={styles.hint}>
        WordPress에 올라갈 글의 모습을 대략 확인합니다.
      </Text>

      {featured ? (
        <View style={styles.featuredWrap}>
          <Image source={{ uri: featured }} style={styles.featured} />
          <Text style={styles.featuredHint}>
            {restaurant ? "대표 이미지 (도입부 사진)" : "대표 이미지 (첫 단계 사진)"}
          </Text>
        </View>
      ) : null}

      <Text style={styles.title}>{draft.title.trim() || "(제목 없음)"}</Text>

      {excerptText ? (
        <Text style={styles.excerpt}>{excerptText}</Text>
      ) : (
        <Text style={styles.excerptPlaceholder}>
          {restaurant
            ? "도입부 내용이 비어 있습니다. (요약글로 사용)"
            : "요약이 비어 있습니다."}
        </Text>
      )}

      {draft.tags.length > 0 ? (
        <View style={styles.tags}>
          {draft.tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showRestaurantMap && restaurant ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>가게 위치</Text>
          <Text style={styles.sectionHint}>
            {restaurant.basicInfo.address.trim() || restaurantLocation!.label}
          </Text>
          <LocationMapPreview
            location={restaurantLocation!}
            mapService={restaurant.mapProvider}
            compact
          />
        </View>
      ) : null}

      <View style={styles.divider} />

      <MarkdownPreviewBody body={previewBody} />

      {stepsWithLocation.length > 0 && draft.template !== "restaurant" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>방문 장소</Text>
          <Text style={styles.sectionHint}>
            단계에 저장한 위치입니다. 지도를 탭하면 구글 지도에서 열립니다.
          </Text>
          {stepsWithLocation.map((step) => {
            const stepNum = steps.findIndex((s) => s.id === step.id) + 1;
            return (
              <View key={step.id} style={styles.locCard}>
                {steps.length > 1 ? (
                  <Text style={styles.locStepBadge}>단계 {stepNum}</Text>
                ) : null}
                <LocationMapPreview location={step.location!} />
              </View>
            );
          })}
        </View>
      ) : null}

      {stepsWithImages.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>단계 사진</Text>
          {stepsWithImages.map((step, idx) => (
            <View key={step.id} style={styles.stepCard}>
              <Image source={{ uri: step.imageUri! }} style={styles.stepImg} />
              {step.caption.trim() ? (
                <Text style={styles.stepCaption}>{step.caption.trim()}</Text>
              ) : (
                <Text style={styles.stepCaptionMuted}>
                  단계 {idx + 1} · 설명 없음
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.secondaryBtn} onPress={onEdit}>
          <Text style={styles.secondaryText}>편집으로</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={handlePublish}>
          <Text style={styles.primaryText}>WordPress 등록</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingBottom: 48 },
  badge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  hint: { marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 20 },
  featuredWrap: {
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  featured: { width: "100%", height: 200, backgroundColor: "#f1f5f9" },
  featuredHint: {
    padding: 8,
    fontSize: 12,
    color: "#64748b",
    backgroundColor: "#f8fafc",
  },
  title: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 36,
  },
  excerpt: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: "#475569",
  },
  excerptPlaceholder: {
    marginTop: 10,
    fontSize: 15,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tagChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tagText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 20,
  },
  section: { marginTop: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 12,
    lineHeight: 18,
  },
  locCard: { marginBottom: 16 },
  locStepBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  stepCard: {
    marginBottom: 14,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  stepImg: { width: "100%", height: 160, backgroundColor: "#f1f5f9" },
  stepCaption: {
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    color: "#334155",
  },
  stepCaptionMuted: {
    padding: 12,
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 28 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  secondaryText: { color: "#475569", fontWeight: "600" },
});
