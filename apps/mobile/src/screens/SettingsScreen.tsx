import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApi } from "../context/ApiContext";
import { isApiConnectionError } from "../api/client";
import { fetchHealth } from "../api/health";
import { verifyWordPress } from "../api/wordpress";
import {
  clearWpSettings,
  loadWpSettings,
  saveWpSettings,
  type WpSettings,
} from "../storage/wpSettingsStorage";

type Props = { onClose: () => void };

export function SettingsScreen({ onClose }: Props) {
  const { apiBaseUrl, setApiBaseUrl, resetApiBaseUrl } = useApi();
  const [input, setInput] = useState(apiBaseUrl);
  const [testing, setTesting] = useState(false);

  const [wp, setWp] = useState<WpSettings>({
    siteUrl: "",
    username: "",
    appPassword: "",
  });
  const [wpSaving, setWpSaving] = useState(false);
  const [wpVerifying, setWpVerifying] = useState(false);

  useEffect(() => {
    setInput(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadWpSettings().then(setWp);
  }, []);

  const test = async () => {
    setTesting(true);
    try {
      await setApiBaseUrl(input);
      const h = await fetchHealth();
      Alert.alert(
        "9ruDocs API 연결 성공",
        `PC API에 연결되었습니다.\n${h.service}\n${h.timestamp}`,
      );
    } catch (e) {
      Alert.alert(
        "9ruDocs API 연결 실패",
        e instanceof Error
          ? e.message
          : "API 주소·PC 방화벽·Wi-Fi를 확인하세요.",
      );
    } finally {
      setTesting(false);
    }
  };

  const saveWp = async () => {
    setWpSaving(true);
    try {
      await saveWpSettings(wp);
      Alert.alert("저장됨", "WordPress 설정이 이 기기에 저장되었습니다.");
    } catch (e) {
      Alert.alert(
        "저장 실패",
        e instanceof Error ? e.message : "알 수 없는 오류",
      );
    } finally {
      setWpSaving(false);
    }
  };

  const testWp = async () => {
    setWpVerifying(true);
    try {
      await setApiBaseUrl(input);
      const h = await fetchHealth();
      await saveWpSettings(wp);
      const res = await verifyWordPress(wp);
      const who = res.user.name ?? res.user.slug ?? "사용자";
      Alert.alert(
        "WordPress 연결 성공",
        `9ruDocs API: ${h.service}\n\n` +
          `WordPress: ${res.siteUrl}\n${who} (ID: ${res.user.id ?? "?"})`,
      );
    } catch (e) {
      if (isApiConnectionError(e)) {
        Alert.alert("9ruDocs API 연결 실패", e.message);
        return;
      }
      Alert.alert(
        "WordPress 연결 실패",
        e instanceof Error
          ? e.message
          : "사이트 URL·사용자명·애플리케이션 비밀번호를 확인하세요.",
      );
    } finally {
      setWpVerifying(false);
    }
  };

  const resetWp = async () => {
    await clearWpSettings();
    setWp({ siteUrl: "", username: "", appPassword: "" });
    Alert.alert("초기화됨", "WordPress 설정이 삭제되었습니다.");
  };

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.wrap}>
        <Text style={styles.title}>9ruDocs API (PC)</Text>
        <Text style={styles.hint}>
          폰이 접속할 PC의 9ruDocs API 주소입니다. WordPress 사이트 주소와 다릅니다.
          {"\n"}
          프리뷰 APK는 Expo Go와 달리 첫 설치 시 주소가 비어 있거나
          placeholder(192.168.0.1)일 수 있습니다 — 반드시 PC IP로 바꿔 주세요.
        </Text>
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>PC IP 찾기 (자동 검색 불가)</Text>
          <Text style={styles.tipBody}>
            1. PC에서 cmd 열기{"\n"}
            2. ipconfig 입력 → 「무선 LAN 어댑터 Wi-Fi」 IPv4 확인{"\n"}
            3. 예: 192.168.0.10 → http://192.168.0.10:3001{"\n"}
            4. scripts\start-api.bat 실행 중인지 확인{"\n"}
            5. 폰·PC 같은 Wi-Fi, 방화벽에서 Node 허용
          </Text>
        </View>
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
            <Text style={styles.btnText}>저장 후 API 연결 테스트</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={() => void resetApiBaseUrl()}
        >
          <Text style={styles.linkText}>기본값으로 초기화</Text>
        </Pressable>
      </View>

      <View style={[styles.wrap, styles.wpWrap]}>
        <Text style={styles.title}>WordPress (블로그 사이트)</Text>
        <Text style={styles.hint}>
          위 API 주소와 별도로, 글을 올릴 WordPress 사이트 정보를 입력하세요.
          {"\n"}
          연결 테스트는 ① PC API 연결 확인 후 ② WordPress 인증을 순서대로 검사합니다.
          {"\n"}
          URL 예: https://yoursite.com (https 포함, /wp-admin·/wp-json 붙이지
          않음)
          {"\n"}
          일반 로그인 비밀번호 대신 WordPress에서 발급한 애플리케이션 비밀번호를
          사용하는 것을 권장합니다. 자격 증명은 이 기기(AsyncStorage)에만 저장되며
          서버 .env는 미입력 시 대체(fallback)로 사용됩니다.
        </Text>
        <Text style={styles.label}>사이트 URL</Text>
        <TextInput
          style={styles.input}
          value={wp.siteUrl}
          onChangeText={(siteUrl) => setWp((p) => ({ ...p, siteUrl }))}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://yoursite.com"
        />
        <Text style={styles.label}>사용자명</Text>
        <TextInput
          style={styles.input}
          value={wp.username}
          onChangeText={(username) => setWp((p) => ({ ...p, username }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="wordpress_username"
        />
        <Text style={styles.label}>애플리케이션 비밀번호</Text>
        <TextInput
          style={styles.input}
          value={wp.appPassword}
          onChangeText={(appPassword) => setWp((p) => ({ ...p, appPassword }))}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
        />
        <Pressable
          style={styles.btn}
          disabled={wpSaving}
          onPress={() => void saveWp()}
        >
          {wpSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>WordPress 설정 저장</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          disabled={wpVerifying}
          onPress={() => void testWp()}
        >
          {wpVerifying ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            <Text style={styles.btnSecondaryText}>WordPress 연결 테스트</Text>
          )}
        </Pressable>
        <Pressable style={styles.link} onPress={() => void resetWp()}>
          <Text style={styles.linkText}>WordPress 설정 초기화</Text>
        </Pressable>
      </View>

      <Pressable style={styles.close} onPress={onClose}>
        <Text style={styles.closeText}>닫기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, maxHeight: 520, marginBottom: 12 },
  wrap: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  wpWrap: { marginTop: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  hint: { marginTop: 8, fontSize: 13, color: "#64748b", lineHeight: 20 },
  tipBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tipTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  tipBody: { marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 18 },
  label: { marginTop: 12, fontSize: 13, fontWeight: "600", color: "#334155" },
  input: {
    marginTop: 6,
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
  btnSecondary: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  btnSecondaryText: { color: "#2563eb", fontWeight: "700" },
  link: { marginTop: 12, alignItems: "center" },
  linkText: { color: "#64748b" },
  close: { marginTop: 12, marginBottom: 8, alignItems: "center" },
  closeText: { color: "#2563eb", fontWeight: "600" },
});
