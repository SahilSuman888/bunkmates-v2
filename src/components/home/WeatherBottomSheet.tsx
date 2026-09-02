import { View, Text, StyleSheet } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { useMemo, useRef } from "react";
import { BlurView } from "../ui/AppBlurView";

interface Props {
  weather: any;
}

export default function WeatherBottomSheet({ weather }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["25%", "60%"], []);

  if (!weather) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: "#111" }}
    >
      <View style={styles.container}>
        <BlurView intensity={50} tint="dark" style={styles.card}>
          <Text style={styles.title}>Weather Details</Text>
          <Text style={styles.text}>
            Condition: {weather.main}
          </Text>
          <Text style={styles.text}>
            Temperature: {weather.temp}°C
          </Text>
          <Text style={styles.text}>
            Description: {weather.desc}
          </Text>
        </BlurView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 10,
  },
  text: {
    color: "#ddd",
    marginBottom: 6,
  },
});