import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

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
    quality: 0.85,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  const uri = result.assets[0].uri;
  await saveToGallery(uri);
  return uri;
}

export async function pickImageFromGallery(): Promise<string | null> {
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!lib.granted) {
    Alert.alert("권한 필요", "갤러리 권한을 허용해 주세요.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.85,
    allowsEditing: true,
    mediaTypes: ["images"],
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function pickImage(useCamera: boolean): Promise<string | null> {
  return useCamera ? pickImageFromCamera() : pickImageFromGallery();
}
