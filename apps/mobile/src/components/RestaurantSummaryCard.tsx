import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { VoiceInputButton } from "./VoiceInputButton";
import { StarRatingRow } from "./StarRatingRow";
import type { RestaurantRatings } from "../types";
import { RATING_LABELS, RATING_KEYS } from "../utils/restaurantRatings";

type Props = {
  headText: string;
  tailText: string;
  ratings: RestaurantRatings;
  onChangeHead: (text: string) => void;
  onChangeTail: (text: string) => void;
  onChangeRatings: (ratings: RestaurantRatings) => void;
};

export function RestaurantSummaryCard({
  headText,
  tailText,
  ratings,
  onChangeHead,
  onChangeTail,
  onChangeRatings,
}: Props) {
  const [editing, setEditing] = useState(true);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>6. 총평</Text>

      <Pressable style={styles.editToggle} onPress={() => setEditing((v) => !v)}>
        <Text style={styles.editToggleText}>{editing ? "👁 미리보기" : "✏️ 편집"}</Text>
      </Pressable>

      {editing ? (
        <>
          <Text style={styles.subLabel}>한줄 총평</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              multiline
              value={headText}
              onChangeText={onChangeHead}
              placeholder="전체적으로 만족도가 높은 식사였습니다."
            />
            <VoiceInputButton baseText={headText} onResult={onChangeHead} />
          </View>

          <Text style={styles.subLabel}>항목별 별점 (터치)</Text>
          {RATING_KEYS.map((key) => (
            <StarRatingRow
              key={key}
              label={RATING_LABELS[key]}
              value={ratings[key]}
              onChange={(v) => onChangeRatings({ ...ratings, [key]: v })}
            />
          ))}

          <Text style={styles.subLabel}>추천 멘트</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              multiline
              value={tailText}
              onChangeText={onChangeTail}
              placeholder="한 번 방문해 보시는 것을 추천드립니다."
            />
            <VoiceInputButton baseText={tailText} onResult={onChangeTail} />
          </View>
        </>
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.preview}>
          <Text style={styles.previewText}>{headText || "(한줄 총평 없음)"}</Text>
          {RATING_KEYS.map((key) => (
            <Text key={key} style={styles.previewStar}>
              ✔ {RATING_LABELS[key]}{" "}
              {"★".repeat(ratings[key])}
              {"☆".repeat(5 - ratings[key])}
            </Text>
          ))}
          <Text style={[styles.previewText, { marginTop: 8 }]}>
            {tailText || "(추천 멘트 없음)"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  editToggle: { alignSelf: "flex-end", marginBottom: 8 },
  editToggleText: { fontSize: 12, fontWeight: "600", color: "#3730a3" },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 6,
    marginTop: 4,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    minHeight: 64,
    fontSize: 15,
    textAlignVertical: "top",
    backgroundColor: "#fff",
  },
  preview: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  previewText: { fontSize: 15, color: "#334155", lineHeight: 22 },
  previewStar: { fontSize: 14, color: "#475569", marginTop: 6 },
});
