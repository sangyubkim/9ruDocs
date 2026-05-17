import * as FileSystem from "expo-file-system";

export async function imageUriToBase64(
  uri: string,
): Promise<{ base64: string; mimeType: string; filename: string }> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64",
  });
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
  return {
    base64,
    mimeType,
    filename: `step-${Date.now()}.${ext === "png" ? "png" : "jpg"}`,
  };
}
