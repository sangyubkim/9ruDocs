import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  EXPO_GO_SPEECH_MESSAGE,
  isSpeechRecognitionNativeAvailable,
} from "../utils/speechRecognition";

type Props = {
  onResult: (text: string) => void;
  disabled?: boolean;
  /** 인식 시작 전 기존 텍스트 (append 시 사용) */
  baseText?: string;
};

export function VoiceInputButton({
  onResult,
  disabled,
  baseText = "",
}: Props) {
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const speechRef = useRef<typeof import("expo-speech-recognition") | null>(
    null,
  );
  const baseRef = useRef(baseText);
  const transcriptRef = useRef("");
  const subsRef = useRef<{ remove: () => void }[]>([]);

  useEffect(() => {
    baseRef.current = baseText;
  }, [baseText]);

  useEffect(() => {
    setAvailable(isSpeechRecognitionNativeAvailable());
    return () => {
      subsRef.current.forEach((s) => s.remove());
      subsRef.current = [];
    };
  }, []);

  const loadModule = useCallback(async () => {
    if (speechRef.current) return speechRef.current;
    if (!isSpeechRecognitionNativeAvailable()) return null;
    try {
      const mod = await import("expo-speech-recognition");
      speechRef.current = mod;
      return mod;
    } catch {
      return null;
    }
  }, []);

  const clearListeners = useCallback(() => {
    subsRef.current.forEach((s) => s.remove());
    subsRef.current = [];
  }, []);

  const mergeTranscript = useCallback(() => {
    const chunk = transcriptRef.current.trim();
    if (!chunk) return;
    const merged = baseRef.current
      ? `${baseRef.current.trimEnd()} ${chunk}`.trim()
      : chunk;
    onResult(merged);
  }, [onResult]);

  const stopListening = useCallback(
    async (applyResult: boolean) => {
      const mod = speechRef.current;
      if (mod) {
        try {
          mod.ExpoSpeechRecognitionModule.stop();
        } catch {
          /* ignore */
        }
      }
      clearListeners();
      setListening(false);
      if (applyResult) mergeTranscript();
    },
    [clearListeners, mergeTranscript],
  );

  const handlePress = useCallback(async () => {
    if (disabled || loading) return;

    if (listening) {
      await stopListening(true);
      return;
    }

    if (available === false) {
      Alert.alert("음성 입력", EXPO_GO_SPEECH_MESSAGE);
      return;
    }

    setLoading(true);
    const mod = await loadModule();
    setLoading(false);

    if (!mod) {
      setAvailable(false);
      Alert.alert("음성 입력", EXPO_GO_SPEECH_MESSAGE);
      return;
    }

    const { ExpoSpeechRecognitionModule } = mod;

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert(
        "음성 입력 불가",
        "이 기기에서 음성 인식을 사용할 수 없습니다.\n개발 빌드에서 마이크·음성 인식 권한이 필요합니다.",
      );
      return;
    }

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", "마이크·음성 인식 권한을 허용해 주세요.");
      return;
    }

    transcriptRef.current = "";
    clearListeners();

    const resultSub = mod.ExpoSpeechRecognitionModule.addListener(
      "result",
      (event) => {
        const results = event.results ?? [];
        const latest = results[results.length - 1]?.transcript ?? "";
        if (!latest) return;
        transcriptRef.current = latest;
      },
    );

    const onEnd = mod.ExpoSpeechRecognitionModule.addListener("end", () => {
      setListening(false);
      clearListeners();
    });

    const onError = mod.ExpoSpeechRecognitionModule.addListener(
      "error",
      (event) => {
        setListening(false);
        clearListeners();
        if (event.error === "not-allowed") {
          Alert.alert("권한 필요", "음성 인식 권한이 거부되었습니다.");
          return;
        }
        if (Platform.OS !== "web") {
          Alert.alert(
            "음성 인식 오류",
            `${event.message ?? event.error}\nExpo Go에서는 제한될 수 있습니다.`,
          );
        }
      },
    );

    subsRef.current = [resultSub, onEnd, onError];

    try {
      ExpoSpeechRecognitionModule.start({
        lang: "ko-KR",
        interimResults: true,
        continuous: true,
      });
      setListening(true);
    } catch (e) {
      setListening(false);
      clearListeners();
      Alert.alert(
        "음성 인식 시작 실패",
        e instanceof Error
          ? `${e.message}\nExpo Go에서는 제한될 수 있습니다.`
          : EXPO_GO_SPEECH_MESSAGE,
      );
    }
  }, [
    available,
    clearListeners,
    disabled,
    listening,
    loadModule,
    loading,
    stopListening,
  ]);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[
          styles.btn,
          listening && styles.btnListening,
          (disabled || loading) && styles.btnDisabled,
        ]}
        disabled={disabled || loading}
        onPress={() => void handlePress()}
        accessibilityLabel={listening ? "음성 입력 중지" : "음성 입력 시작"}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#b91c1c" />
        ) : (
          <Text style={[styles.icon, listening && styles.iconListening]}>
            {listening ? "🎙️" : "🎤"}
          </Text>
        )}
      </Pressable>
      {listening ? (
        <Text style={styles.listeningLabel}>듣는 중…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginLeft: 8 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnListening: {
    backgroundColor: "#fecaca",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  btnDisabled: { opacity: 0.45 },
  icon: { fontSize: 18 },
  iconListening: { fontSize: 17 },
  listeningLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: "#dc2626",
  },
});
