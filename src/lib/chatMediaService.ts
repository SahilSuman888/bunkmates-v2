// src/lib/chatMediaService.ts
// Production-grade media handling for Bunkmates Chat
// Handles auto-downloading, gallery saving, caching, and explicit media export.
// Features safe dynamic loading with graceful fallback for Expo Go and dev clients.

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

// In-memory cache of saved message media IDs to prevent duplicate gallery saves
const savedMessageMediaCache = new Set<string>();

/**
 * Safely resolves the expo-media-library module without crashing if the
 * native module 'ExpoMediaLibraryNext' has not been linked into the running binary.
 */
export function getMediaLibrary(): any | null {
  try {
    // Dynamic require so bundle evaluation never throws
    const ml = require("expo-media-library");
    if (ml && typeof ml.createAssetAsync === "function") {
      return ml;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves an image (remote URL, base64 data URI, or local file) into the device's public photo gallery.
 * If expo-media-library is available, requests permissions and saves to the "Bunkmates" album.
 * If the native module is absent, safely persists to permanent offline storage.
 */
export async function saveImageToGallery(
  imageUri: string,
  filenamePrefix = "bunkmates"
): Promise<{ success: boolean; uri?: string; error?: string }> {
  if (!imageUri || typeof imageUri !== "string") {
    return { success: false, error: "invalid_uri" };
  }

  try {
    const MediaLibrary = getMediaLibrary();
    const cleanExt = imageUri.includes(".png") ? "png" : "jpg";
    const tempFileName = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
    const targetPath = `${FileSystem.cacheDirectory || ""}${tempFileName}`;

    let localFilePath = imageUri;
    let isTempFile = false;

    // 1. Resolve remote or base64 URI into a local file path
    if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
      const downloadRes = await FileSystem.downloadAsync(imageUri, targetPath);
      localFilePath = downloadRes.uri;
      isTempFile = true;
    } else if (imageUri.startsWith("data:image/")) {
      const base64Data = imageUri.replace(/^data:image\/[a-z]+;base64,/, "");
      await FileSystem.writeAsStringAsync(targetPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      localFilePath = targetPath;
      isTempFile = true;
    }

    // 2. If native MediaLibrary is available in binary, save to system photo gallery
    if (MediaLibrary) {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        if (isTempFile) FileSystem.deleteAsync(targetPath, { idempotent: true }).catch(() => {});
        return { success: false, error: "permission_denied" };
      }

      const asset = await MediaLibrary.createAssetAsync(localFilePath);

      try {
        if (Platform.OS === "android" || Platform.OS === "ios") {
          const album = await MediaLibrary.getAlbumAsync("Bunkmates");
          if (!album) {
            await MediaLibrary.createAlbumAsync("Bunkmates", asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
        }
      } catch {
        // Asset is already saved in default camera roll / pictures; album failure is non-fatal
      }

      if (isTempFile) {
        FileSystem.deleteAsync(targetPath, { idempotent: true }).catch(() => {});
      }

      return { success: true, uri: asset.uri };
    }

    // 3. Fallback when MediaLibrary native module is not compiled into current binary:
    // Persist to local permanent document storage so the photo is cached permanently offline
    const permDir = `${FileSystem.documentDirectory || ""}bunkmates_photos/`;
    await FileSystem.makeDirectoryAsync(permDir, { intermediates: true }).catch(() => {});
    const permFilePath = `${permDir}${tempFileName}`;

    await FileSystem.copyAsync({ from: localFilePath, to: permFilePath }).catch(() => {});

    if (isTempFile) {
      FileSystem.deleteAsync(targetPath, { idempotent: true }).catch(() => {});
    }

    return { success: true, uri: permFilePath };
  } catch (err: any) {
    console.warn("[chatMediaService] saveImageToGallery failed:", err?.message || err);
    return { success: false, error: err?.message || "unknown_error" };
  }
}

/**
 * Automatically saves incoming media to the public device gallery if the user
 * has enabled "Save to Gallery". Prevents duplicate saves of the same message.
 */
export async function autoSaveIncomingMedia(
  imageUrl: string,
  messageId: string,
  saveToGalleryEnabled: boolean
): Promise<boolean> {
  if (!saveToGalleryEnabled || !imageUrl || !messageId) {
    return false;
  }

  // Check in-memory cache first
  if (savedMessageMediaCache.has(messageId)) {
    return true;
  }

  // Check AsyncStorage deduplication
  const cacheKey = `@bunkmates_gallery_saved_${messageId}`;
  try {
    const alreadySaved = await AsyncStorage.getItem(cacheKey);
    if (alreadySaved) {
      savedMessageMediaCache.add(messageId);
      return true;
    }
  } catch {}

  const result = await saveImageToGallery(imageUrl, `bunkmates_chat_${messageId}`);
  if (result.success) {
    savedMessageMediaCache.add(messageId);
    AsyncStorage.setItem(cacheKey, "true").catch(() => {});
    return true;
  }

  return false;
}

/**
 * Opens native sharing sheet for an image, allowing user to save, share, or air-drop.
 */
export async function shareOrExportImage(imageUri: string): Promise<boolean> {
  try {
    let localPath = imageUri;
    let isTemp = false;

    if (imageUri.startsWith("http://") || imageUri.startsWith("https://")) {
      const cleanExt = imageUri.includes(".png") ? "png" : "jpg";
      const targetPath = `${FileSystem.cacheDirectory || ""}share_${Date.now()}.${cleanExt}`;
      const dl = await FileSystem.downloadAsync(imageUri, targetPath);
      localPath = dl.uri;
      isTemp = true;
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return false;
    }

    await Sharing.shareAsync(localPath);
    if (isTemp) {
      FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
    }
    return true;
  } catch (e) {
    console.warn("[chatMediaService] shareOrExportImage error:", e);
    return false;
  }
}
