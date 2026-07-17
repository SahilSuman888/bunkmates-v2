import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import dayjs from "dayjs";
import WeatherGridCard from "./WeatherGridCard";
import HourlyForecast from "./HourlyForecast";
import { fetchForecast } from "../../../lib/WeatherService";

const { height } = Dimensions.get("window");

export default function WeatherDetailsSheet({ weather, visible, onClose }: any) {
  const [forecast, setForecast] = useState<any[]>([]);

  useEffect(() => {
    if (visible && weather?.coord) {
      fetchForecast(weather.coord.lat, weather.coord.lon)
        .then((data) => setForecast(data.list))
        .catch((err) => console.log(err));
    }
  }, [visible, weather]);

  if (!weather) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop to close the sheet */}
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <BlurView intensity={60} tint="dark" style={styles.container}>
          <View style={styles.dragHandle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            
            <View style={styles.header}>
              <Text style={styles.city}>{weather.name}, IN</Text>
              <Text style={styles.stationId}>Station ID: {weather.id}</Text>
            </View>

            <View style={styles.mainTempContainer}>
              <Text style={styles.temp}>{Math.round(weather.main.temp)}°</Text>
              <Text style={styles.condition}>{weather.weather[0].description}</Text>
            </View>

            <HourlyForecast data={forecast} />

            <Text style={styles.sectionTitle}>1. METEOROLOGICAL DATA</Text>
            <View style={styles.grid}>
              <WeatherGridCard label="Feels Like" value={`${Math.round(weather.main.feels_like)}°C`} />
              <WeatherGridCard label="Pressure" value={`${weather.main.pressure} hPa`} />
              <WeatherGridCard label="Humidity" value={`${weather.main.humidity}%`} />
            </View>

            <Text style={styles.sectionTitle}>2. SKY & PRECIPITATION</Text>
            <View style={styles.grid}>
              <WeatherGridCard label="Cloudiness" value={`${weather.clouds.all}%`} />
              <WeatherGridCard label="Condition" value={weather.weather[0].main} />
              <WeatherGridCard label="Rain (1h)" value={`${weather.rain?.['1h'] || 0} mm`} />
            </View>

            <Text style={styles.sectionTitle}>4. SOLAR & SYSTEM</Text>
            <View style={styles.grid}>
              <WeatherGridCard label="Sunrise" value={dayjs.unix(weather.sys.sunrise).format("HH:mm")} />
              <WeatherGridCard label="Sunset" value={dayjs.unix(weather.sys.sunset).format("HH:mm")} />
            </View>

          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    height: height * 0.85,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  dragHandle: {
    width: 45,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    alignSelf: 'center',
    marginVertical: 15,
  },
  header: { alignItems: 'center', marginBottom: 15 },
  city: { color: "#fff", fontSize: 24, fontWeight: "800" },
  stationId: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
  mainTempContainer: { alignItems: 'center', marginBottom: 20 },
  temp: { fontSize: 95, fontWeight: "bold", color: "#fff" },
  condition: { color: "#fff", fontSize: 18, textTransform: 'capitalize' },
  sectionTitle: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "bold", marginVertical: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 10 },
});