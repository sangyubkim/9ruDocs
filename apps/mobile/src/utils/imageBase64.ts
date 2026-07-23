import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

/** 프록시(Apache) 한도를 넘지 않도록 이미지당 base64 대략 상한 (~1.2MB 원본) */
const MAX_BASE64_CHARS = 1_600_000;
const MAX_EDGE = 1600;

async function compressUri(uri: string, edge: number, quality: number) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: edge } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
}

export async function imageUriToBase64(
  uri: string,
): Promise<{ base64: string; mimeType: string; filename: string }> {
  const trimmed = String(uri ?? "").trim();
  if (!trimmed) {
    throw new Error("이미지 경로가 비어 있습니다.");
  }

  // 발행 직전에도 한 번 더 축소·압축 (이미 등록된 원본 대비)
  try {
    let edge = MAX_EDGE;
    let quality = 0.7;
    for (let attempt = 0; attempt < 3; attempt++) {
      const manipulated = await compressUri(trimmed, edge, quality);
      const base64 = String(manipulated.base64 ?? "");
      if (base64.length >= 32 && base64.length <= MAX_BASE64_CHARS) {
        return {
          base64,
          mimeType: "image/jpeg",
          filename: `step-${Date.now()}.jpg`,
        };
      }
      edge = Math.max(800, Math.floor(edge * 0.75));
      quality = Math.max(0.45, quality - 0.15);
    }
  } catch {
    /* manipulate 실패 시 FileSystem fallback */
  }

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(trimmed, {
      encoding: "base64",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/deprecated/i.test(msg)) {
      throw new Error(
        "이미지 읽기 API가 구버전입니다. 앱을 최신으로 다시 실행(리로드)해 주세요.",
      );
    }
    throw new Error(`이미지를 읽지 못했습니다: ${msg.slice(0, 120)}`);
  }

  if (!base64 || base64.length < 32) {
    throw new Error("이미지 데이터가 비어 있습니다. 사진을 다시 첨부해 주세요.");
  }
  if (base64.length > MAX_BASE64_CHARS) {
    throw new Error(
      "이미지 용량이 너무 커서 WordPress로 올릴 수 없습니다. 사진 수를 줄이거나 더 작은 사진으로 다시 첨부해 주세요.",
    );
  }

  return {
    base64,
    mimeType: "image/jpeg",
    filename: `step-${Date.now()}.jpg`,
  };
}
