import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function WeatherGridCard({ label, value }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "31%", // Adjusted for 3-column grid with gap
    backgroundColor: "rgba(255, 255, 255, 0.05)", // More transparent glass effect
    padding: 12,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)", // Subtle border from image
  },
  label: {
    color: "rgba(255, 255, 255, 0.5)", // Dimmest text color
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  value: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18, // Slightly larger for readability
    marginTop: 4,
  },
});