import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TemplateType } from "../types";

type Props = {
  visible: boolean;
  current: TemplateType;
  onSelect: (template: TemplateType) => void;
  onClose: () => void;
};

export function TemplatePicker({
  visible,
  current,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>템플릿 선택</Text>

          <Pressable
            style={[styles.option, current === "restaurant" && styles.optionActive]}
            onPress={() => {
              onSelect("restaurant");
              onClose();
            }}
          >
            <Text style={styles.optionTitle}>맛집 템플릿</Text>
            <Text style={styles.optionDesc}>
              도입부·기본정보·분위기·메뉴·리뷰 구조로 쉽게 작성
            </Text>
          </Pressable>

          <Pressable
            style={[styles.option, current === "basic" && styles.optionActive]}
            onPress={() => {
              onSelect("basic");
              onClose();
            }}
          >
            <Text style={styles.optionTitle}>기본 템플릿</Text>
            <Text style={styles.optionDesc}>
              단계별 사진·설명 입력 후 AI 글쓰기 (기존 화면)
            </Text>
          </Pressable>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  option: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  optionActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  optionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  optionDesc: { marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 18 },
  cancel: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: "#64748b", fontWeight: "600" },
});
