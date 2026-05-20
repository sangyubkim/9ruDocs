import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { VoiceInputButton } from "../components/VoiceInputButton";
import type { BlogDraft } from "../types";

type Props = {
  draft: BlogDraft;
  onChangeDraft: (draft: BlogDraft) => void;
  onBack: () => void;
  onPreview: () => void;
  onPublish: () => void;
};

function LabeledInput({
  label,
  value,
  onChangeText,
  multiline,
  minHeight,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  minHeight?: number;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            styles.inputFlex,
            multiline && styles.multiline,
            minHeight != null && { minHeight },
          ]}
          multiline={multiline}
          value={value}
          onChangeText={onChangeText}
        />
        <VoiceInputButton baseText={value} onResult={onChangeText} />
      </View>
    </>
  );
}

export function EditScreen({
  draft,
  onChangeDraft,
  onBack,
  onPreview,
  onPublish,
}: Props) {
  const patch = (partial: Partial<BlogDraft>) =>
    onChangeDraft({ ...draft, ...partial, updatedAt: new Date().toISOString() });

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <LabeledInput
        label="제목"
        value={draft.title}
        onChangeText={(title) => patch({ title })}
      />

      <LabeledInput
        label="요약 (SEO·발췌)"
        value={draft.excerpt}
        onChangeText={(excerpt) => patch({ excerpt })}
        multiline
        minHeight={80}
      />

      <Text style={styles.label}>태그 (쉼표 구분)</Text>
      <TextInput
        style={styles.input}
        value={draft.tags.join(", ")}
        onChangeText={(text) =>
          patch({
            tags: text
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }
      />

      <LabeledInput
        label="본문 (Markdown)"
        value={draft.body}
        onChangeText={(body) => patch({ body })}
        multiline
        minHeight={280}
      />

      <View style={styles.row}>
        <Pressable style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryText}>← 단계 목록</Text>
        </Pressable>
        <Pressable style={styles.previewBtn} onPress={onPreview}>
          <Text style={styles.previewText}>미리보기</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={onPublish}>
          <Text style={styles.primaryText}>WordPress 등록</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingBottom: 40 },
  label: { fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 12 },
  inputRow: { flexDirection: "row", alignItems: "flex-start" },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  inputFlex: { flex: 1 },
  multiline: { textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
  primaryBtn: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
  previewBtn: {
    flexGrow: 1,
    flexBasis: "30%",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    alignItems: "center",
  },
  previewText: { color: "#1d4ed8", fontWeight: "700" },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  secondaryText: { color: "#475569", fontWeight: "600" },
});
