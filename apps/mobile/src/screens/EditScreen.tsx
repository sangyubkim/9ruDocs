import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
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

const EXTRA_PAD = 24;
const BODY_MAX_HEIGHT = Math.round(Dimensions.get("window").height * 0.45);

function LabeledInput({
  label,
  value,
  onChangeText,
  multiline,
  minHeight,
  maxHeight,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  minHeight?: number;
  maxHeight?: number;
  onFocus?: () => void;
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
            maxHeight != null && { maxHeight },
          ]}
          multiline={multiline}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          textAlignVertical={multiline ? "top" : undefined}
          scrollEnabled={multiline}
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
  const scrollRef = useRef<ScrollView>(null);
  const bodyWrapRef = useRef<View>(null);
  const bodyFocusedRef = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const patch = (partial: Partial<BlogDraft>) =>
    onChangeDraft({ ...draft, ...partial, updatedAt: new Date().toISOString() });

  const scrollBodyAboveKeyboard = () => {
    // 본문 하단(커서 근처)이 키보드 위로 오도록 ScrollView를 끝까지 스크롤
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      const height = e.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);
      if (bodyFocusedRef.current) {
        setTimeout(scrollBodyAboveKeyboard, Platform.OS === "ios" ? 50 : 120);
      }
    };
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const keyboardVisible = keyboardHeight > 0;
  // Android resize 모드에서도 Expo Go 등에서 레이아웃이 안 줄 수 있어
  // 키보드 높이만큼 하단 padding을 항상 추가해 스크롤 여유를 확보한다.
  const bottomPad = (keyboardVisible ? keyboardHeight : 0) + EXTRA_PAD + 24;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      // Android는 softwareKeyboardLayoutMode=resize + keyboardHeight padding으로 처리.
      // KAV behavior를 쓰면 resize와 이중으로 줄어들 수 있어 iOS만 padding 적용.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator
      >
        <LabeledInput
          label="제목"
          value={draft.title}
          onChangeText={(title) => patch({ title })}
          onFocus={() => {
            bodyFocusedRef.current = false;
          }}
        />

        <LabeledInput
          label="요약 (SEO·발췌)"
          value={draft.excerpt}
          onChangeText={(excerpt) => patch({ excerpt })}
          multiline
          minHeight={80}
          onFocus={() => {
            bodyFocusedRef.current = false;
          }}
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
          onFocus={() => {
            bodyFocusedRef.current = false;
          }}
        />

        <View
          ref={bodyWrapRef}
          onLayout={() => {
            if (bodyFocusedRef.current && keyboardVisible) {
              scrollBodyAboveKeyboard();
            }
          }}
        >
          <LabeledInput
            label="본문 (Markdown)"
            value={draft.body}
            onChangeText={(body) => patch({ body })}
            multiline
            minHeight={280}
            maxHeight={BODY_MAX_HEIGHT}
            onFocus={() => {
              bodyFocusedRef.current = true;
              setTimeout(scrollBodyAboveKeyboard, Platform.OS === "ios" ? 80 : 150);
            }}
          />
        </View>

        {!keyboardVisible ? (
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
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
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
