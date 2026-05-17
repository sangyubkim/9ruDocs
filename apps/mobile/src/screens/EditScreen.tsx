import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { BlogDraft } from "../types";

type Props = {
  draft: BlogDraft;
  onChangeDraft: (draft: BlogDraft) => void;
  onBack: () => void;
  onPublish: () => void;
};

export function EditScreen({ draft, onChangeDraft, onBack, onPublish }: Props) {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.label}>제목</Text>
      <TextInput
        style={styles.input}
        value={draft.title}
        onChangeText={(title) =>
          onChangeDraft({ ...draft, title, updatedAt: new Date().toISOString() })
        }
      />

      <Text style={styles.label}>요약 (SEO·발췌)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={draft.excerpt}
        onChangeText={(excerpt) =>
          onChangeDraft({ ...draft, excerpt, updatedAt: new Date().toISOString() })
        }
      />

      <Text style={styles.label}>태그 (쉼표 구분)</Text>
      <TextInput
        style={styles.input}
        value={draft.tags.join(", ")}
        onChangeText={(text) =>
          onChangeDraft({
            ...draft,
            tags: text
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            updatedAt: new Date().toISOString(),
          })
        }
      />

      <Text style={styles.label}>본문 (Markdown)</Text>
      <TextInput
        style={[styles.input, styles.body]}
        multiline
        value={draft.body}
        onChangeText={(body) =>
          onChangeDraft({ ...draft, body, updatedAt: new Date().toISOString() })
        }
      />

      <View style={styles.row}>
        <Pressable style={styles.secondaryBtn} onPress={onBack}>
          <Text style={styles.secondaryText}>← 단계 목록</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  body: { minHeight: 280, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, marginTop: 20 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700" },
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
