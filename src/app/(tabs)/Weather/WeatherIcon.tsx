import React from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function WeatherIcon({ condition, size = 40 }: { condition: string; size?: number }) {
  const iconMap: any = {
    Clear: "white-balance-sunny",
    Clouds: "cloud-outline",
    Rain: "weather-rainy",
    Thunderstorm: "weather-lightning",
    Snow: "weather-snowy",
    Drizzle: "weather-partly-rainy",
    Mist: "weather-fog",
    Smoke: "weather-fog",
    Haze: "weather-hazy",
  };

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons 
        name={iconMap[condition] || "cloud-outline"} 
        size={size} 
        color={condition === "Clear" ? "#FFD700" : "#fff"} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});