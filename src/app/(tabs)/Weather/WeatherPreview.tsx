import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function WeatherPreview({ weather, onPress }: any) {
  if (!weather) return null;

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Icon with subtle glow effect as seen in UI */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons 
          name="white-balance-sunny" 
          size={32} 
          color="#FFD700" 
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.temp}>
          {Math.round(weather.main.temp)}°C - {weather.name || "Pindwāra"}
        </Text>
        <Text style={styles.desc}>
          {weather.weather[0].description || "Clear Sky"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    // Creating the subtle circular glow behind the icon seen in the image
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 12,
  },
  temp: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  desc: {
    color: "rgba(255, 255, 255, 0.5)", // Matches the dim text in your screenshots
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});