import Constants from "expo-constants";

import { Platform } from "react-native";



/**

 * PC에서 ipconfig 로 IPv4 확인 후 여기에 넣거나,

 * 앱 설정 화면(톱니바퀴)에서 폰으로 직접 입력하세요.

 */

const PC_LAN_IP = ""; // 예: "192.168.0.10"



/** 빌드 시 EAS/env 로 주입 가능 (실기기 LAN IP는 보통 빌드 전에 알 수 없음) */

const BUILD_TIME_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(

  /\/+$/,

  "",

);



/** 앱에 저장되지 않은 기본값 — 프리뷰 APK 첫 설치 시 PC API에 연결되지 않음 */

export const PLACEHOLDER_API_URLS = new Set([

  "http://192.168.0.1:3001",

  "http://localhost:3001",

  "http://127.0.0.1:3001",

  "http://10.0.2.2:3001",

]);



export function normalizeApiBaseUrl(url: string): string {

  return url.trim().replace(/\/+$/, "");

}



export function isPlaceholderApiUrl(url: string): boolean {

  return PLACEHOLDER_API_URLS.has(normalizeApiBaseUrl(url));

}



export function getDefaultApiBaseUrl(): string {

  if (BUILD_TIME_API_URL) {

    return BUILD_TIME_API_URL;

  }

  if (PC_LAN_IP) {

    return `http://${PC_LAN_IP}:3001`;

  }

  const isRealDevice = Constants.isDevice;

  if (isRealDevice) {

    return "http://192.168.0.1:3001";

  }

  const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";

  return `http://${host}:3001`;

}



export function needsApiUrlSetup(url: string): boolean {

  if (!Constants.isDevice) return false;

  if (BUILD_TIME_API_URL && !isPlaceholderApiUrl(BUILD_TIME_API_URL)) {

    return false;

  }

  return isPlaceholderApiUrl(url);

}



/** @deprecated ApiContext 의 apiBaseUrl 사용 */

export const API_BASE_URL = getDefaultApiBaseUrl();

