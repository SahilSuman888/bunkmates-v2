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
  BackHandler,
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
}: SwipeableDrawerProps) {
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const [translateY] = useState(() => new Animated.Value(SCREEN_HEIGHT));
  const isClosingRef = useRef(false);

  // Sync modalVisible state on visible prop transition
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setModalVisible(true);
    }
  }

  // Directly interpolate backdrop opacity from translateY on UI thread — ZERO JS bridge overhead
  const backdropOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, SCREEN_HEIGHT * 0.7],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [translateY]
  );

  // Ultra-smooth native dismiss animation
  const dismissAnimated = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      isClosingRef.current = false;
      onClose();
    });
  }, [onClose, translateY]);

  // Handle visibility changes with physics-based spring
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 25,
        mass: 0.75,
        stiffness: 280,
        overshootClamping: true,
        useNativeDriver: true,
      }).start();
    } else if (modalVisible && !isClosingRef.current) {
      dismissAnimated();
    }
  }, [visible, modalVisible, dismissAnimated, translateY]);

  // Handle Android hardware back button
  useEffect(() => {
    if (!modalVisible) return;
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissAnimated();
      return true;
    });
    return () => backSub.remove();
  }, [modalVisible, dismissAnimated]);

  const dismissAnimatedRef = useRef(dismissAnimated);
  const dismissThresholdRef = useRef(dismissThreshold);
  useEffect(() => {
    dismissAnimatedRef.current = dismissAnimated;
    dismissThresholdRef.current = dismissThreshold;
  }, [dismissAnimated, dismissThreshold]);

  // Dedicated PanResponder for the top Grab Handle area — fluid 60/120fps gesture
  // eslint-disable-next-line react-hooks/refs
  const [handlePanResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateY.setValue(gestureState.dy * 0.12);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > dismissThresholdRef.current || gestureState.vy > 0.45) {
          dismissAnimatedRef.current();
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
    })
  );

  // Sheet-level PanResponder for downward drags from non-scrolling areas (does NOT capture or block inner ScrollViews)
  // eslint-disable-next-line react-hooks/refs
  const [sheetPanResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 18 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 2;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        } else {
          translateY.setValue(gestureState.dy * 0.12);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > dismissThresholdRef.current || gestureState.vy > 0.45) {
          dismissAnimatedRef.current();
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
    })
  );

  if (!modalVisible) return null;

  const content = (
    <View style={[styles.overlayContainer, containerStyle]}>
      {/* Animated Backdrop with native interpolated opacity */}
      <TouchableWithoutFeedback
        onPress={closeOnBackdropPress ? dismissAnimated : undefined}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: backdropColor, opacity: backdropOpacity },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Swipeable Drawer Sheet */}
      <Animated.View
        {...sheetPanResponder.panHandlers}
        style={[
          styles.drawerSheet,
          {
            maxHeight: maxHeight as any,
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateY }],
          },
          sheetStyle,
        ]}
      >
        {/* Touch-optimized Handle Bar Area with large touch target */}
        {showHandle && (
          <View {...handlePanResponder.panHandlers} style={styles.handleWrapper}>
            <View style={[styles.handlePill, { backgroundColor: handleColor }]} />
          </View>
        )}

        {children}
      </Animated.View>
    </View>
  );

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={dismissAnimated}
      statusBarTranslucent
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardContainer}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  drawerSheet: {
    width: "100%",
    backgroundColor: "#161618",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 4,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.3,
        shadowRadius: 18,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  handleWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 14,
  },
  handlePill: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
});

export default SwipeableDrawer;
