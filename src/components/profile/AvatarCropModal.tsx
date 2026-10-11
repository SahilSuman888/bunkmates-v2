import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Image,
  PanResponder,
  Animated,
  ActivityIndicator,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import { BlurView } from "expo-blur";
import { cropAvatarImage } from "../../lib/imageCompressor";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CROP_CONTAINER_SIZE = Math.min(SCREEN_WIDTH - 36, 360);
const CROP_CIRCLE_DIAMETER = Math.round(CROP_CONTAINER_SIZE * 0.82);

interface AvatarCropModalProps {
  visible: boolean;
  imageUri: string | null;
  currentAvatarUri?: string | null;
  onCancel: () => void;
  onSaveCropped: (croppedUri: string) => void;
}

export default function AvatarCropModal({
  visible,
  imageUri,
  currentAvatarUri,
  onCancel,
  onSaveCropped,
}: AvatarCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: CROP_CONTAINER_SIZE,
    height: CROP_CONTAINER_SIZE,
  });
  const [cropping, setCropping] = useState(false);

  // Pan offset animation
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentPan = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (imageUri) {
      setZoom(1);
      pan.setValue({ x: 0, y: 0 });
      currentPan.current = { x: 0, y: 0 };

      Image.getSize(
        imageUri,
        (w, h) => {
          if (w > 0 && h > 0) {
            setNaturalSize({ width: w, height: h });
          }
        },
        () => {
          setNaturalSize({ width: 1000, height: 1000 });
        }
      );
    }
  }, [imageUri, visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: currentPan.current.x,
          y: currentPan.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        currentPan.current.x += gestureState.dx;
        currentPan.current.y += gestureState.dy;
        pan.flattenOffset();
      },
    })
  ).current;

  // Calculate base display size preserving aspect ratio
  const aspect = naturalSize.width / (naturalSize.height || 1);
  let baseDisplayW = CROP_CONTAINER_SIZE;
  let baseDisplayH = CROP_CONTAINER_SIZE;

  if (aspect >= 1) {
    baseDisplayH = CROP_CONTAINER_SIZE;
    baseDisplayW = CROP_CONTAINER_SIZE * aspect;
  } else {
    baseDisplayW = CROP_CONTAINER_SIZE;
    baseDisplayH = CROP_CONTAINER_SIZE / aspect;
  }

  const handleSave = async () => {
    if (!imageUri || cropping) return;

    try {
      setCropping(true);

      // Compute cropped area relative to natural image dimensions
      const displayedWidth = baseDisplayW * zoom;
      const displayedHeight = baseDisplayH * zoom;

      const scaleRatioX = naturalSize.width / displayedWidth;
      const scaleRatioY = naturalSize.height / displayedHeight;

      // Circle center inside container
      const containerCenterX = CROP_CONTAINER_SIZE / 2;
      const containerCenterY = CROP_CONTAINER_SIZE / 2;

      // Top-left of the image inside the container
      const imgTopLeftX = containerCenterX - displayedWidth / 2 + currentPan.current.x;
      const imgTopLeftY = containerCenterY - displayedHeight / 2 + currentPan.current.y;

      // Top-left of crop circle inside the container
      const circleTopLeftX = containerCenterX - CROP_CIRCLE_DIAMETER / 2;
      const circleTopLeftY = containerCenterY - CROP_CIRCLE_DIAMETER / 2;

      // Offset of crop circle relative to image
      const cropOffsetX = (circleTopLeftX - imgTopLeftX) * scaleRatioX;
      const cropOffsetY = (circleTopLeftY - imgTopLeftY) * scaleRatioY;
      const cropPixelWidth = CROP_CIRCLE_DIAMETER * scaleRatioX;
      const cropPixelHeight = CROP_CIRCLE_DIAMETER * scaleRatioY;

      const cropArea = {
        originX: Math.max(0, Math.round(cropOffsetX)),
        originY: Math.max(0, Math.round(cropOffsetY)),
        cropWidth: Math.round(cropPixelWidth),
        cropHeight: Math.round(cropPixelHeight),
      };

      // Produce a tiny 300x300 JPEG (~30 KB)
      const result = await cropAvatarImage(imageUri, cropArea, 300, 65);

      onSaveCropped(result.dataUri);
    } catch (e) {
      console.warn("Failed to crop avatar:", e);
      // Fallback: send raw image URI
      onSaveCropped(imageUri);
    } finally {
      setCropping(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {/* Blurred background preview mimicking screenshot 3 */}
        {Platform.OS === "ios" ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
        )}

        {/* Blurred header preview at top */}
        <View style={styles.topHeaderPreview}>
          <Text style={styles.topHeaderTitle}>Edit Profile</Text>
          {currentAvatarUri ? (
            <Image
              source={{ uri: currentAvatarUri }}
              style={styles.topAvatarPreview}
              blurRadius={Platform.OS === "ios" ? 15 : 6}
            />
          ) : (
            <View style={[styles.topAvatarPreview, styles.topAvatarFallback]}>
              <Text style={styles.topAvatarLetter}>M</Text>
            </View>
          )}
        </View>

        {/* Central Crop Card */}
        <View style={styles.cropCard}>
          {/* Draggable & Scalable Image */}
          <View
            style={styles.imageViewport}
            {...panResponder.panHandlers}
          >
            <Animated.View
              style={[
                styles.imageWrapper,
                {
                  width: baseDisplayW,
                  height: baseDisplayH,
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { scale: zoom },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            </Animated.View>

            {/* Circular Crop Mask Overlay */}
            <View style={styles.maskContainer} pointerEvents="none">
              {/* Outer dark vignette */}
              <View style={styles.maskDarkFill} />

              {/* The bright circle guide */}
              <View style={styles.circleCutout}>
                {/* Thin crisp white circle border */}
                <View style={styles.circleBorder} />
              </View>
            </View>
          </View>
        </View>

        {/* Zoom Slider Controller matching Screenshot 3 */}
        <View style={styles.zoomControlRow}>
          <Text style={styles.zoomLabel}>Zoom</Text>
          <View style={styles.sliderTrackContainer}>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={3}
              step={0.02}
              value={zoom}
              onValueChange={(val) => setZoom(val)}
              minimumTrackTintColor="#2b2d35"
              maximumTrackTintColor="#1c1d22"
              thumbTintColor="#ffffff"
            />
          </View>
        </View>

        {/* Bottom Pill Buttons matching Screenshot 3 */}
        <View style={styles.bottomButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.pillButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={onCancel}
            disabled={cropping}
          >
            <Text style={styles.pillButtonText}>Cancel</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.pillButton,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleSave}
            disabled={cropping}
          >
            {cropping ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text style={styles.pillButtonText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? 44 : 54,
    paddingBottom: Platform.OS === "android" ? 28 : 40,
    paddingHorizontal: 20,
  },
  androidBlur: {
    backgroundColor: "rgba(6, 7, 9, 0.95)",
  },
  topHeaderPreview: {
    alignItems: "center",
    opacity: 0.35,
    marginTop: 10,
  },
  topHeaderTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  topAvatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: "#00a884",
  },
  topAvatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  topAvatarLetter: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "bold",
  },
  cropCard: {
    width: CROP_CONTAINER_SIZE,
    height: CROP_CONTAINER_SIZE,
    borderRadius: 22,
    backgroundColor: "#111317",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  imageViewport: {
    width: "100%",
    height: "100%",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  maskDarkFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },
  circleCutout: {
    width: CROP_CIRCLE_DIAMETER,
    height: CROP_CIRCLE_DIAMETER,
    borderRadius: CROP_CIRCLE_DIAMETER / 2,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  circleBorder: {
    width: CROP_CIRCLE_DIAMETER,
    height: CROP_CIRCLE_DIAMETER,
    borderRadius: CROP_CIRCLE_DIAMETER / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  zoomControlRow: {
    width: CROP_CONTAINER_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  zoomLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  sliderTrackContainer: {
    flex: 1,
    height: 36,
    justifyContent: "center",
  },
  slider: {
    width: "100%",
    height: 36,
  },
  bottomButtonsRow: {
    width: CROP_CONTAINER_SIZE,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    marginTop: 16,
  },
  pillButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  pillButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
