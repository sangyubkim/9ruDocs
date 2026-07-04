import { useState } from "react";
import {
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
}: Props) {
  const [editing, setEditing] = useState(true);

  const addImage = async (useCamera: boolean) => {
    const uri = await pickImage(useCamera);
    if (uri) onChangeImages([...images, uri]);
  };

  const removeImage = (index: number) => {
    onChangeImages(images.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      {images.length > 0 ? (
        <View style={styles.imageGrid}>
          {images.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.imageWrap}>
              <Image source={{ uri }} style={styles.thumb} />
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
          onPress={onRemove ?? (() => onChangeContent(""))}
        >
          <Text style={styles.toolBtnDangerText}>
            {onRemove ? "리뷰 삭제" : "삭제"}
          </Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { minHeight }]}
            multiline
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
  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 10,
  },
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
    marginLeft: "auto",
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
