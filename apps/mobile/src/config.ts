import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * PC에서 ipconfig 로 IPv4 확인 후 여기에 넣거나,
 * 앱 설정 화면(톱니바퀴)에서 폰으로 직접 입력하세요.
 */
const PC_LAN_IP = ""; // 예: "192.168.0.10"

export function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  if (PC_LAN_IP) {
    return `http://${PC_LAN_IP}:3001`;
  }
  // 실제 폰: localhost / 10.0.2.2 는 PC API에 연결되지 않음
  const isRealDevice = Constants.isDevice;
  if (isRealDevice) {
    return "http://192.168.0.1:3001"; // 설정 화면에서 반드시 수정
  }
  const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  return `http://${host}:3001`;
}

/** @deprecated ApiContext 의 apiBaseUrl 사용 */
export const API_BASE_URL = getDefaultApiBaseUrl();
