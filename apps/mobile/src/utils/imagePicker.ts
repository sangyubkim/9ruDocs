import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

/** 긴 변 기준 — WP/프록시 용량을 넘지 않도록 등록 시 축소 */
const MAX_IMAGE_EDGE = 1600;
const COMPRESS_QUALITY = 0.7;

async function compressPickedImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_EDGE } }],
      {
        compress: COMPRESS_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return result.uri || uri;
  } catch {
    return uri;
  }
}

async function saveToGallery(uri: string): Promise<void> {
  try {
    const MediaLibrary = await import("expo-media-library");
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return;
    await MediaLibrary.saveToLibraryAsync(uri);
  } catch {
    /* 갤러리 저장 실패는 촬영 자체를 막지 않음 */
  }
}

export async function pickImageFromCamera(): Promise<string | null> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  if (!cam.granted) {
    Alert.alert("권한 필요", "카메라 권한을 허용해 주세요.");
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: COMPRESS_QUALITY,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  const compressed = await compressPickedImage(result.assets[0].uri);
  await saveToGallery(compressed);
  return compressed;
}

export async function pickImageFromGallery(): Promise<string | null> {
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) {
    Alert.alert("권한 필요", "갤러리 권한을 허용해 주세요.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: COMPRESS_QUALITY,
    allowsEditing: true,
    mediaTypes: ["images"],
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return compressPickedImage(result.assets[0].uri);
}

export async function pickImage(useCamera: boolean): Promise<string | null> {
  return useCamera ? pickImageFromCamera() : pickImageFromGallery();
}
