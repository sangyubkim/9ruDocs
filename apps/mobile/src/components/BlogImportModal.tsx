import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatNetworkError } from "../api/blog";
import {
  applyRestaurantBlogImport,
  searchRestaurantBlogs,
  type RestaurantImportRequest,
  type RestaurantImportResponse,
  type RestaurantImportSource,
} from "../api/restaurant";

type Props = {
  visible: boolean;
  payload: RestaurantImportRequest | null;
  onClose: () => void;
  onApplied: (result: RestaurantImportResponse) => void | Promise<void>;
};

type Step = "list" | "preview";

function sortLabel(sort?: "sim" | "date") {
  if (sort === "sim") return "정확도";
  if (sort === "date") return "최신";
  return "";
}

export function BlogImportModal({
  visible,
  payload,
  onClose,
  onApplied,
}: Props) {
  const [step, setStep] = useState<Step>("list");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<RestaurantImportSource[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [selected, setSelected] = useState<RestaurantImportSource | null>(null);

  const reset = useCallback(() => {
    setStep("list");
    setLoading(false);
    setApplying(false);
    setError("");
    setSources([]);
    setSearchedQuery("");
    setSelected(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!visible || !payload) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setStep("list");
    setSelected(null);

    void (async () => {
      try {
        const result = await searchRestaurantBlogs(payload);
        if (cancelled) return;
        setSources(result.sources);
        setSearchedQuery(result.searchedQuery);
        if (result.sources.length === 0) {
          setError(
            result.searchError
              ? `블로그 검색 오류: ${result.searchError}`
              : result.searchedQuery
                ? `「${result.searchedQuery}」 검색 결과가 없습니다.`
                : "검색된 블로그가 없습니다.",
          );
        }
      } catch (e) {
        if (!cancelled) setError(formatNetworkError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, payload]);

  const handleSelect = (source: RestaurantImportSource) => {
    setSelected(source);
    setStep("preview");
    setError("");
  };

  const handleApply = async () => {
    if (!payload || !selected?.url) return;
    setApplying(true);
    setError("");
    try {
      const result = await applyRestaurantBlogImport({
        ...payload,
        selectedUrl: selected.url,
      });
      await onApplied(result);
      handleClose();
    } catch (e) {
      setError(formatNetworkError(e));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === "list" ? "블로그 선택" : "블로그 미리보기"}
            </Text>
            {step === "preview" ? (
              <Pressable
                style={styles.backBtn}
                onPress={() => {
                  setStep("list");
                  setError("");
                }}
              >
                <Text style={styles.backBtnText}>← 목록</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.closeBtn} onPress={handleClose}>
                <Text style={styles.closeBtnText}>닫기</Text>
              </Pressable>
            )}
          </View>

          {searchedQuery ? (
            <Text style={styles.queryHint}>검색: {searchedQuery}</Text>
          ) : null}

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>블로그 검색 중…</Text>
            </View>
          ) : step === "list" ? (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {sources.length === 0 && !error ? (
                <Text style={styles.emptyText}>검색된 블로그가 없습니다.</Text>
              ) : null}
              {sources.map((source) => (
                <Pressable
                  key={source.url}
                  style={styles.sourceCard}
                  onPress={() => handleSelect(source)}
                >
                  <Text style={styles.sourceTitle} numberOfLines={2}>
                    {source.title}
                  </Text>
                  <View style={styles.sourceMeta}>
                    {source.blogger ? (
                      <Text style={styles.sourceMetaText}>{source.blogger}</Text>
                    ) : null}
                    {source.postDate ? (
                      <Text style={styles.sourceMetaText}>{source.postDate}</Text>
                    ) : null}
                    {source.matchedSort ? (
                      <Text style={styles.sourceBadge}>
                        {sortLabel(source.matchedSort)}
                      </Text>
                    ) : null}
                  </View>
                  {source.excerpt ? (
                    <Text style={styles.sourceExcerpt} numberOfLines={3}>
                      {source.excerpt}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : selected ? (
            <>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {selected.title}
              </Text>
              <ScrollView
                style={styles.previewScroll}
                contentContainerStyle={styles.previewContent}
              >
                <Text style={styles.previewText}>
                  {selected.content || selected.excerpt || "본문 없음"}
                </Text>
              </ScrollView>
              <Pressable
                style={[styles.applyBtn, applying && styles.btnDisabled]}
                disabled={applying}
                onPress={() => void handleApply()}
              >
                {applying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.applyBtnText}>이 블로그로 가져오기</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  closeBtn: { padding: 6 },
  closeBtnText: { color: "#64748b", fontWeight: "600", fontSize: 14 },
  backBtn: { padding: 6 },
  backBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 14 },
  queryHint: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  loadingText: { color: "#475569", fontSize: 14 },
  list: { maxHeight: 420 },
  emptyText: {
    textAlign: "center",
    color: "#64748b",
    paddingVertical: 32,
    fontSize: 14,
  },
  sourceCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#f8fafc",
  },
  sourceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  sourceMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
    alignItems: "center",
  },
  sourceMetaText: { fontSize: 12, color: "#64748b" },
  sourceBadge: {
    fontSize: 11,
    color: "#2563eb",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  sourceExcerpt: { fontSize: 13, color: "#475569", lineHeight: 19 },
  previewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  previewScroll: {
    maxHeight: 340,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
  },
  previewContent: { padding: 12 },
  previewText: { fontSize: 14, color: "#334155", lineHeight: 22 },
  applyBtn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  errorText: {
    marginTop: 10,
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
});
