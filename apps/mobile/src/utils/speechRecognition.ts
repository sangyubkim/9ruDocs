import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/** Expo Go 등 네이티브 모듈이 없을 때 false — import 전에 호출 */
export function isSpeechRecognitionNativeAvailable(): boolean {
  if (Platform.OS === "web") return true;
  return requireOptionalNativeModule("ExpoSpeechRecognition") != null;
}

export const EXPO_GO_SPEECH_MESSAGE =
  "Expo Go에서는 음성 인식이 제한됩니다. 개발 빌드(npx expo run:android)를 사용하거나 키보드로 입력해 주세요.";
