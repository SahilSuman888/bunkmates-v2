// **@** Ported from bunkmates-v2-main: Reusable QR Camera Scanner Component
import React, { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import {
  CameraView,
  CameraType,
  useCameraPermissions,
} from "expo-camera";

interface Props {
  onScanSuccess: (data: string) => void;
  onScanError?: (error: string) => void;
}

const QrScanner = ({ onScanSuccess, onScanError }: Props) => {
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    setScanned(true);

    try {
      onScanSuccess(data);
    } catch (err: any) {
      onScanError?.(err.message);
      setScanned(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.loader}>
        <Text>Camera permission required.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={{
          flex: 1,
        }}
        facing={"back" as CameraType}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
    </View>
  );
};

export default QrScanner;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 400,
    alignSelf: "center",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  loader: {
    height: 400,
    justifyContent: "center",
    alignItems: "center",
  },
});
