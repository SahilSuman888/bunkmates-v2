import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  StyleProp,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface SwipeableDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showHandle?: boolean;
  handleColor?: string;
  sheetStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  dismissThreshold?: number;
  closeOnBackdropPress?: boolean;
  avoidKeyboard?: boolean;
  maxHeight?: number | string;
  enableSheetDrag?: boolean;
}

export function SwipeableDrawer({
  visible,
  onClose,
  children,
  showHandle = true,
  handleColor = "rgba(255, 255, 255, 0.28)",
  sheetStyle,
  containerStyle,
  backdropColor = "rgba(0, 0, 0, 0.65)",
  dismissThreshold = 65,
  closeOnBackdropPress = true,
  avoidKeyboard = true,
  maxHeight = "90%",
  enableSheetDrag = true,
}: SwipeableDrawerProps) {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(visible);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isClosingRef = useRef(false);
  const isOpeningRef = useRef(false);
  const prevVisibleRef = useRef(visible);

  // Directly interpolate backdrop opacity from translateY on UI thread
  const backdropOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, SCREEN_HEIGHT * 0.7],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [translateY]
  );

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // User-initiated dismiss (via backdrop tap, grab drag-down, or Android hardware back)
  const handleUserDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    isOpeningRef.current = false;

    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      isClosingRef.current = false;
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    });
  }, [translateY]);

  // Handle visibility transitions from props cleanly without double-animation loops
  useEffect(() => {
    if (visible === prevVisibleRef.current && modalVisible === visible) {
      return;
    }
    prevVisibleRef.current = visible;

    if (visible) {
      if (modalVisible && !isClosingRef.current) {
        return;
      }
      isClosingRef.current = false;
      isOpeningRef.current = true;
      setModalVisible(true);
      translateY.setValue(SCREEN_HEIGHT);

      Animated.spring(translateY, {
        toValue: 0,
        damping: 24,
        mass: 0.75,
        stiffness: 280,
        overshootClamping: true,
        useNativeDriver: true,
      }).start(() => {
        isOpeningRef.current = false;
      });
    } else {
      if (!modalVisible || isClosingRef.current) {
        return;
      }
      isClosingRef.current = true;
      isOpeningRef.current = false;
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
        isClosingRef.current = false;
      });
    }
  }, [visible, modalVisible, translateY]);

  const dismissThresholdRef = useRef(dismissThreshold);
  useEffect(() => {
    dismissThresholdRef.current = dismissThreshold;
  }, [dismissThreshold]);

  // PanResponder for the Grab Handle area
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 4 || Math.abs(gestureState.dy) > 4;
        },
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          } else {
            translateY.setValue(gestureState.dy * 0.12);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > dismissThresholdRef.current || gestureState.vy > 0.35) {
            handleUserDismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 22,
              mass: 0.7,
              stiffness: 300,
              overshootClamping: true,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [handleUserDismiss, translateY]
  );

  // Sheet-level PanResponder for downward drags from ANYWHERE on the drawer
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 12 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.4;
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          } else {
            translateY.setValue(gestureState.dy * 0.12);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > dismissThresholdRef.current || gestureState.vy > 0.35) {
            handleUserDismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 22,
              mass: 0.7,
              stiffness: 300,
              overshootClamping: true,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            mass: 0.7,
            stiffness: 300,
            overshootClamping: true,
            useNativeDriver: true,
          }).start();
        },
      }),
    [handleUserDismiss, translateY]
  );

  const flattenedSheetStyle = useMemo(
    () => (StyleSheet.flatten(sheetStyle) || {}) as ViewStyle,
    [sheetStyle]
  );
  const passedPaddingBottom = typeof flattenedSheetStyle.paddingBottom === "number"
    ? flattenedSheetStyle.paddingBottom
    : typeof flattenedSheetStyle.padding === "number"
    ? flattenedSheetStyle.padding
    : 0;

  // Safe bottom clearance for navigation bars and home indicator
  const systemBottom = insets.bottom > 0
    ? insets.bottom
    : (Platform.OS === "android" ? 20 : 12);

  // Guarantee at least systemBottom + 14 so action buttons are never hidden
  const computedBottomPadding = Math.max(passedPaddingBottom, systemBottom + 60);

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleUserDismiss}
      statusBarTranslucent
    >
      <View style={[styles.overlayContainer, containerStyle]}>
        {/* Animated Backdrop */}
        <TouchableWithoutFeedback onPress={closeOnBackdropPress ? handleUserDismiss : undefined}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: backdropColor, opacity: backdropOpacity },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Swipeable Drawer Sheet */}
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardAvoid}
            pointerEvents="box-none"
          >
            <Animated.View
              {...(enableSheetDrag ? sheetPanResponder.panHandlers : {})}
              style={[
                styles.drawerSheet,
                sheetStyle,
                {
                  maxHeight: maxHeight as any,
                  flexShrink: 1,
                  paddingBottom: computedBottomPadding,
                  transform: [{ translateY }],
                },
              ]}
            >
              {showHandle && (
                <View {...handlePanResponder.panHandlers} style={styles.handleWrapper}>
                  <View style={[styles.handlePill, { backgroundColor: handleColor }]} />
                </View>
              )}
              {children}
            </Animated.View>
          </KeyboardAvoidingView>
        ) : (
          <Animated.View
            {...(enableSheetDrag ? sheetPanResponder.panHandlers : {})}
            style={[
              styles.drawerSheet,
              sheetStyle,
              {
                maxHeight: maxHeight as any,
                flexShrink: 1,
                paddingBottom: computedBottomPadding,
                transform: [{ translateY }],
              },
            ]}
          >
            {showHandle && (
              <View {...handlePanResponder.panHandlers} style={styles.handleWrapper}>
                <View style={[styles.handlePill, { backgroundColor: handleColor }]} />
              </View>
            )}
            {children}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    width: "100%",
    justifyContent: "flex-end",
    maxHeight: "100%",
    flexShrink: 1,
  },
  drawerSheet: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    flexShrink: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 24,
  },
  handleWrapper: {
    width: "100%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
  },
  handlePill: {
    width: 42,
    height: 4.5,
    borderRadius: 2.5,
  },
});

export default SwipeableDrawer;
