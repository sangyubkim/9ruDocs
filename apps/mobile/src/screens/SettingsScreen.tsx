import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApi } from "../context/ApiContext";
import { fetchHealth } from "../api/health";

type Props = { onClose: () => void };

export function SettingsScreen({ onClose }: Props) {
  const { apiBaseUrl, setApiBaseUrl, resetApiBaseUrl } = useApi();
  const [input, setInput] = useState(apiBaseUrl);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setInput(apiBaseUrl);
  }, [apiBaseUrl]);

  const test = async () => {
    setTesting(true);
    try {
      await setApiBaseUrl(input);
      const h = await fetchHealth();
      Alert.alert("연결 성공", `${h.service}\n${h.timestamp}`);
    } catch (e) {
      Alert.alert(
        "연결 실패",
        e instanceof Error ? e.message : "API 주소·PC 방화벽·Wi-Fi를 확인하세요.",
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>API 설정</Text>
      <Text style={styles.hint}>
        PC에서 ipconfig 로 IPv4 확인 후 입력 (예: http://192.168.0.10:3001)
        {"\n"}PC에서 scripts\start-api.bat 실행 중이어야 합니다.
      </Text>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://192.168.0.10:3001"
      />
      <Pressable
        style={styles.btn}
        disabled={testing}
        onPress={() => void test()}
      >
        {testing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>저장 후 연결 테스트</Text>
        )}
      </Pressable>
      <Pressable
        style={styles.link}
        onPress={() => void resetApiBaseUrl()}
      >
        <Text style={styles.linkText}>기본값으로 초기화</Text>
      </Pressable>
      <Pressable style={styles.close} onPress={onClose}>
        <Text style={styles.closeText}>닫기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  hint: { marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 20 },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { marginTop: 12, alignItems: "center" },
  linkText: { color: "#64748b" },
  close: { marginTop: 8, alignItems: "center" },
  closeText: { color: "#2563eb", fontWeight: "600" },
});
