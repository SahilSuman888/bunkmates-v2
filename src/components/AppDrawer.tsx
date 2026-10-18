import React, { ReactNode } from "react";
import { StyleSheet, StyleProp, ViewStyle } from "react-native";
import { SwipeableDrawer } from "./ui/SwipeableDrawer";

export interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  handleColor?: string;
  showHandle?: boolean;
}

export default function AppDrawer({
  visible,
  onClose,
  children,
  sheetStyle,
  handleColor,
  showHandle = true,
}: AppDrawerProps) {
  return (
    <SwipeableDrawer
      visible={visible}
      onClose={onClose}
      showHandle={showHandle}
      handleColor={handleColor}
      sheetStyle={[styles.drawer, sheetStyle]}
    >
      {children}
    </SwipeableDrawer>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
});
