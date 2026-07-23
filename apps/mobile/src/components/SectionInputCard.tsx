import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { VoiceInputButton } from "./VoiceInputButton";
import { pickImage } from "../utils/imagePicker";

type Props = {
  label: string;
  content: string;
  images: string[];
  onChangeContent: (text: string) => void;
  onChangeImages: (uris: string[]) => void;
  onRemove?: () => void;
  placeholder?: string;
  minHeight?: number;
  /** 도입부 등 — 사진 필수 표시 */
  requireImage?: boolean;
};

export function SectionInputCard({
  label,
  content,
  images,
  onChangeContent,
  onChangeImages,
  onRemove,
  placeholder,
  minHeight = 120,
  requireImage = false,
}: Props) {
  const [editing, setEditing] = useState(true);

  const addImage = async (useCamera: boolean) => {
    const uri = await pickImage(useCamera);
    if (uri) onChangeImages([...images, uri]);
  };

  const removeImage = (index: number) => {
    onChangeImages(images.filter((_, i) => i !== index));
  };

  const confirmRemoveSection = () => {
    if (!onRemove) return;
    Alert.alert(
      "섹션 삭제",
      `「${label}」 섹션을 삭제할까요?`,
      [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: onRemove },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {requireImage ? (
          <Text style={styles.requiredBadge}>사진 필수</Text>
        ) : null}
      </View>

      {requireImage && images.length === 0 ? (
        <Text style={styles.requiredHint}>
          대표 이미지로 쓰입니다. 미리보기·WordPress 등록 전에 사진을 첨부하세요.
        </Text>
      ) : null}

      {images.length > 0 ? (
        <View style={styles.imageGrid}>
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.imageWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              {i === 0 && requireImage ? (
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>대표</Text>
                </View>
              ) : null}
              <Pressable style={styles.imageDel} onPress={() => removeImage(i)}>
                <Text style={styles.imageDelText}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.toolRow}>
        <Pressable style={styles.toolBtn} onPress={() => void addImage(true)}>
          <Text style={styles.toolBtnText}>📷 카메라</Text>
        </Pressable>
        <Pressable style={styles.toolBtn} onPress={() => void addImage(false)}>
          <Text style={styles.toolBtnText}>🖼 갤러리</Text>
        </Pressable>
        <Pressable
          style={styles.toolBtn}
          onPress={() => setEditing((v) => !v)}
        >
          <Text style={styles.toolBtnText}>{editing ? "👁 미리보기" : "✏️ 편집"}</Text>
        </Pressable>
        <Pressable
          style={styles.toolBtnDanger}
          onPress={() => onChangeContent("")}
        >
          <Text style={styles.toolBtnDangerText}>내용 비우기</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { minHeight }]}
            multiline
            scrollEnabled={false}
            placeholder={placeholder}
            value={content}
            onChangeText={onChangeContent}
            textAlignVertical="top"
          />
          <VoiceInputButton baseText={content} onResult={onChangeContent} />
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)} style={styles.previewBox}>
          <Text style={styles.previewText}>
            {content.trim() || "(내용 없음 — 탭하여 편집)"}
          </Text>
        </Pressable>
      )}

      {onRemove ? (
        <Pressable
          style={styles.footerDel}
          onPress={confirmRemoveSection}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${label} 섹션 삭제`}
        >
          <Text style={styles.footerDelText}>🗑 {label} 삭제</Text>
        </Pressable>
      ) : null}
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  requiredBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  requiredHint: {
    fontSize: 12,
    color: "#b91c1c",
    marginBottom: 8,
    lineHeight: 18,
  },
  featuredBadge: {
    position: "absolute",
    left: 2,
    bottom: 2,
    backgroundColor: "rgba(37, 99, 235, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuredBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  footerDel: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
  },
  footerDelText: { fontSize: 14, fontWeight: "700", color: "#b91c1c" },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  imageWrap: { position: "relative" },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  imageDel: {
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
  imageDelText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  toolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#e0e7ff",
    borderRadius: 8,
  },
  toolBtnText: { fontSize: 12, fontWeight: "600", color: "#3730a3" },
  toolBtnDanger: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
  },
  toolBtnDangerText: { fontSize: 12, fontWeight: "600", color: "#b91c1c" },
  inputRow: { flexDirection: "row", alignItems: "flex-start" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
    lineHeight: 22,
  },
  previewBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    backgroundColor: "#f8fafc",
  },
  previewText: { fontSize: 15, color: "#334155", lineHeight: 22 },
});
