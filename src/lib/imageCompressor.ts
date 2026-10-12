import { Skia, ImageFormat } from "@shopify/react-native-skia";
import * as FileSystem from "expo-file-system/legacy";

export interface CompressResult {
  base64: string;
  dataUri: string;
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Compresses and downscales any local image URI using Skia so that its Base64 representation
 * stays well under Firestore's 1MB (1,048,487 bytes) document limit.
 *
 * @param sourceUri Local file URI (file://...) or existing Base64 URI
 * @param maxDimension Maximum width or height (e.g. 800 for chat photos, 320 for profile avatars)
 * @param quality JPEG quality 0-100 (default 60)
 */
export async function compressAndResizeImage(
  sourceUri: string,
  maxDimension: number = 800,
  quality: number = 60
): Promise<CompressResult> {
  try {
    let rawBase64 = "";

    if (sourceUri.startsWith("data:")) {
      const commaIdx = sourceUri.indexOf(",");
      rawBase64 = commaIdx > -1 ? sourceUri.slice(commaIdx + 1) : sourceUri;
    } else {
      rawBase64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    // Attempt hardware-accelerated Skia downscale and compression
    const data = Skia.Data.fromBase64(rawBase64);
    const skImg = Skia.Image.MakeImageFromEncoded(data);

    if (skImg) {
      const origW = skImg.width();
      const origH = skImg.height();

      let targetW = origW;
      let targetH = origH;

      if (origW > maxDimension || origH > maxDimension) {
        if (origW >= origH) {
          targetW = maxDimension;
          targetH = Math.max(1, Math.round((origH / origW) * maxDimension));
        } else {
          targetH = maxDimension;
          targetW = Math.max(1, Math.round((origW / origH) * maxDimension));
        }
      }

      const surface = Skia.Surface.Make(targetW, targetH);
      if (surface) {
        const canvas = surface.getCanvas();
        const srcRect = Skia.XYWHRect(0, 0, origW, origH);
        const dstRect = Skia.XYWHRect(0, 0, targetW, targetH);
        const paint = Skia.Paint();
        paint.setAntiAlias(true);

        canvas.drawImageRect(skImg, srcRect, dstRect, paint);

        const snapshot = surface.makeImageSnapshot();
        const compressedBase64 = snapshot.encodeToBase64(ImageFormat.JPEG, quality);
        const dataUri = `data:image/jpeg;base64,${compressedBase64}`;

        // Save a cached file URI as well
        const cacheFilePath = `${FileSystem.cacheDirectory || ""}compressed_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        await FileSystem.writeAsStringAsync(cacheFilePath, compressedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        }).catch(() => {});

        return {
          base64: compressedBase64,
          dataUri,
          uri: cacheFilePath,
          width: targetW,
          height: targetH,
          sizeBytes: compressedBase64.length,
        };
      }
    }

    // Fallback if Skia failed to decode
    const fallbackDataUri = `data:image/jpeg;base64,${rawBase64}`;
    return {
      base64: rawBase64,
      dataUri: fallbackDataUri,
      uri: sourceUri,
      width: maxDimension,
      height: maxDimension,
      sizeBytes: rawBase64.length,
    };
  } catch (error) {
    console.warn("compressAndResizeImage error:", error);
    return {
      base64: "",
      dataUri: sourceUri,
      uri: sourceUri,
      width: maxDimension,
      height: maxDimension,
      sizeBytes: 0,
    };
  }
}

/**
 * Specifically crops a sub-region of an image (for circular avatar selection) and encodes
 * to a compact 300x300 JPEG base64 string (< 40 KB) safe for Firestore Free Plan.
 */
export async function cropAvatarImage(
  sourceUri: string,
  cropArea: {
    originX: number;
    originY: number;
    cropWidth: number;
    cropHeight: number;
  },
  outputSize: number = 300,
  quality: number = 65
): Promise<CompressResult> {
  try {
    let rawBase64 = "";

    if (sourceUri.startsWith("data:")) {
      const commaIdx = sourceUri.indexOf(",");
      rawBase64 = commaIdx > -1 ? sourceUri.slice(commaIdx + 1) : sourceUri;
    } else {
      rawBase64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const data = Skia.Data.fromBase64(rawBase64);
    const skImg = Skia.Image.MakeImageFromEncoded(data);

    if (skImg) {
      const origW = skImg.width();
      const origH = skImg.height();

      // Clamp crop rectangle within image boundaries
      const safeX = Math.max(0, Math.min(cropArea.originX, origW - 10));
      const safeY = Math.max(0, Math.min(cropArea.originY, origH - 10));
      const safeW = Math.max(10, Math.min(cropArea.cropWidth, origW - safeX));
      const safeH = Math.max(10, Math.min(cropArea.cropHeight, origH - safeY));

      const surface = Skia.Surface.Make(outputSize, outputSize);
      if (surface) {
        const canvas = surface.getCanvas();
        const srcRect = Skia.XYWHRect(safeX, safeY, safeW, safeH);
        const dstRect = Skia.XYWHRect(0, 0, outputSize, outputSize);
        const paint = Skia.Paint();
        paint.setAntiAlias(true);

        canvas.drawImageRect(skImg, srcRect, dstRect, paint);

        const snapshot = surface.makeImageSnapshot();
        const compressedBase64 = snapshot.encodeToBase64(ImageFormat.JPEG, quality);
        const dataUri = `data:image/jpeg;base64,${compressedBase64}`;

        const cacheFilePath = `${FileSystem.cacheDirectory || ""}avatar_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(cacheFilePath, compressedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        }).catch(() => {});

        return {
          base64: compressedBase64,
          dataUri,
          uri: cacheFilePath,
          width: outputSize,
          height: outputSize,
          sizeBytes: compressedBase64.length,
        };
      }
    }

    // Fallback: regular downscale
    return compressAndResizeImage(sourceUri, outputSize, quality);
  } catch (err) {
    console.warn("cropAvatarImage error:", err);
    return compressAndResizeImage(sourceUri, outputSize, quality);
  }
}
