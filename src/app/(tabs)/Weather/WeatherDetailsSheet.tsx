import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  Pressable,
  PanResponder,
  Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import dayjs from "dayjs";
import WeatherGridCard from "./WeatherGridCard";
import HourlyForecast from "./HourlyForecast";
import { fetchForecast } from "../../../lib/WeatherService";
import { Feather } from "@expo/vector-icons";

const { height } = Dimensions.get("window");

export default function WeatherDetailsSheet({
  weather,
  aqiValue,
  visible,
  onClose,
}: {
  weather: any;
  aqiValue?: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [forecast, setForecast] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(visible);

  // Animated values for exact bunk-mates-master drawer opening/closing transition
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Handle entry animation when visible becomes true, and exit animation when false
  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      translateY.setValue(height);
      backdropOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          mass: 0.8,
          stiffness: 160,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      handleCloseAnimation();
    }
  }, [visible]);

  // Fetch 24-hour forecast data
  useEffect(() => {
    if (visible && weather?.coord) {
      fetchForecast(weather.coord.lat, weather.coord.lon)
        .then((data) => setForecast(data.list || []))
        .catch((err) => console.log("Forecast fetch error:", err));
    }
  }, [visible, weather]);

  // Exit animation helper: smooth slide-down + backdrop fade-out
  const handleCloseAnimation = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: height,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      onClose();
    });
  };

  // Touch gesture responder for down-swipe drawer dismissal
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          handleCloseAnimation();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!modalVisible) return null;

  const currentTemp = weather?.main?.temp ? Math.round(weather.main.temp) : 28;
  const tempMin = weather?.main?.temp_min ? Math.round(weather.main.temp_min) : 22;
  const tempMax = weather?.main?.temp_max ? Math.round(weather.main.temp_max) : 31;
  const cityName = weather?.name || "Goa";
  const country = weather?.sys?.country || "IN";
  const stationId = weather?.id || "84920";
  const description = weather?.weather?.[0]?.description || "Partly Sunny";

  // AQI color and detail calculation
  const aqiNum = aqiValue ?? 42;
  const getAqiDetails = (val: number) => {
    if (val <= 50)
      return {
        label: "Good / Satisfactory",
        color: "#00e6b0",
        text: "Air quality is good and poses little or no risk.",
      };
    if (val <= 100)
      return {
        label: "Moderate",
        color: "#fbbf24",
        text: "Air quality is acceptable for most individuals.",
      };
    if (val <= 150)
      return {
        label: "Unhealthy for Sensitive Groups",
        color: "#f97316",
        text: "Sensitive groups may experience health effects.",
      };
    if (val <= 200)
      return {
        label: "Unhealthy",
        color: "#ff4757",
        text: "Everyone may begin to experience health effects.",
      };
    return {
      label: "Severe / Hazardous",
      color: "#a855f7",
      text: "Health alert: serious health impacts for all.",
    };
  };
  const aqiDetail = getAqiDetails(aqiNum);

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleCloseAnimation}
    >
      <View style={styles.modalOverlay}>
        {/* Animated backdrop to close the sheet when tapped anywhere outside */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseAnimation} />
        </Animated.View>

        {/* Floating Rounded Drawer Card (Exact bunk-mates-master style & animation) */}
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Touch-drag handle bar for swipe-down dismissal */}
          <View {...panResponder.panHandlers} style={styles.dragZone}>
            <View style={styles.dragHandle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.city}>
                {cityName}, {country}
              </Text>
              <Text style={styles.stationId}>
                Station ID: {stationId} • GMT+5.5
              </Text>
            </View>

            {/* Hero Temperature */}
            <View style={styles.mainTempContainer}>
              <Text style={styles.temp}>{currentTemp}°</Text>
              <Text style={styles.condition}>{description}</Text>
              <View style={styles.hiLoBadge}>
                <Text style={styles.hiLoText}>
                  H: {tempMax}°  •  L: {tempMin}°
                </Text>
              </View>
            </View>

            {/* ============================================================ */}
            {/* AIR QUALITY INDEX (AQI) DRAWER SECTION */}
            {/* ============================================================ */}
            <View style={styles.aqiCard}>
              <View style={styles.aqiHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="wind" size={16} color={aqiDetail.color} />
                  <Text style={styles.aqiSectionTitle}>AIR QUALITY INDEX (AQI)</Text>
                </View>
                <View
                  style={[
                    styles.aqiPill,
                    {
                      backgroundColor: `${aqiDetail.color}22`,
                      borderColor: aqiDetail.color,
                    },
                  ]}
                >
                  <Text style={[styles.aqiPillText, { color: aqiDetail.color }]}>
                    {aqiDetail.label}
                  </Text>
                </View>
              </View>

              <View style={styles.aqiHeroRow}>
                <Text style={[styles.aqiBigNum, { color: aqiDetail.color }]}>
                  {aqiNum}
                </Text>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.aqiDescText}>{aqiDetail.text}</Text>
                  {/* AQI Indicator Bar */}
                  <View style={styles.aqiBarTrack}>
                    <View
                      style={[
                        styles.aqiBarFill,
                        {
                          width: `${Math.min(Math.max((aqiNum / 200) * 100, 8), 100)}%`,
                          backgroundColor: aqiDetail.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Pollutants Breakdown Grid */}
              <Text style={styles.pollutantGridTitle}>POLLUTANTS BREAKDOWN</Text>
              <View style={styles.pollutantGrid}>
                {[
                  { name: "PM2.5", val: "18 µg/m³", status: "Good" },
                  { name: "PM10", val: "42 µg/m³", status: "Good" },
                  { name: "NO2", val: "12 ppb", status: "Low" },
                  { name: "O3", val: "24 ppb", status: "Normal" },
                  { name: "CO", val: "0.4 ppm", status: "Low" },
                  { name: "SO2", val: "5 ppb", status: "Low" },
                ].map((item) => (
                  <View key={item.name} style={styles.pollutantItem}>
                    <Text style={styles.pollutantName}>{item.name}</Text>
                    <Text style={styles.pollutantVal}>{item.val}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 24-Hour Forecast Timeline */}
            <HourlyForecast data={forecast} />

            {/* Section 1: Meteorological Data */}
            <Text style={styles.sectionTitle}>1. METEOROLOGICAL DATA</Text>
            <View style={styles.grid}>
              <WeatherGridCard
                label="Feels Like"
                value={`${Math.round(weather?.main?.feels_like ?? currentTemp)}°C`}
              />
              <WeatherGridCard
                label="Pressure"
                value={`${weather?.main?.pressure ?? 1012} hPa`}
              />
              <WeatherGridCard
                label="Humidity"
                value={`${weather?.main?.humidity ?? 65}%`}
              />
              <WeatherGridCard
                label="Visibility"
                value={`${((weather?.visibility ?? 10000) / 1000).toFixed(1)} km`}
              />
            </View>

            {/* Section 2: Sky & Precipitation */}
            <Text style={styles.sectionTitle}>2. SKY & PRECIPITATION</Text>
            <View style={styles.grid}>
              <WeatherGridCard
                label="Cloudiness"
                value={`${weather?.clouds?.all ?? 20}%`}
              />
              <WeatherGridCard
                label="Condition"
                value={weather?.weather?.[0]?.main ?? "Clear"}
              />
              <WeatherGridCard
                label="Rain (1h)"
                value={`${weather?.rain?.["1h"] || 0} mm`}
              />
              <WeatherGridCard
                label="Snow (1h)"
                value={`${weather?.snow?.["1h"] || 0} mm`}
              />
            </View>

            {/* Section 3: Wind & Atmosphere */}
            <Text style={styles.sectionTitle}>3. WIND & ATMOSPHERE</Text>
            <View style={styles.grid}>
              <WeatherGridCard
                label="Wind Speed"
                value={`${weather?.wind?.speed ?? 3.6} m/s`}
              />
              <WeatherGridCard
                label="Direction"
                value={`${weather?.wind?.deg ?? 180}°`}
              />
              <WeatherGridCard
                label="Gusts"
                value={`${weather?.wind?.gust ?? "—"} m/s`}
              />
            </View>

            {/* Section 4: Solar & System */}
            <Text style={styles.sectionTitle}>4. SOLAR & SYSTEM</Text>
            <View style={styles.grid}>
              <WeatherGridCard
                label="Sunrise"
                value={
                  weather?.sys?.sunrise
                    ? dayjs.unix(weather.sys.sunrise).format("HH:mm")
                    : "06:12"
                }
              />
              <WeatherGridCard
                label="Sunset"
                value={
                  weather?.sys?.sunset
                    ? dayjs.unix(weather.sys.sunset).format("HH:mm")
                    : "18:45"
                }
              />
            </View>

            <Text style={styles.footerNote}>
              BunkMates Weather & Air Quality Engine • Updates Realtime
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  container: {
    height: height * 0.78,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
    backgroundColor: "#07080a",
  },
  dragZone: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  dragHandle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
  },
  city: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  stationId: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    marginTop: 2,
  },
  mainTempContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  temp: {
    fontSize: 84,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -2,
  },
  condition: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  hiLoBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  hiLoText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
  },
  aqiCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 20,
  },
  aqiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  aqiSectionTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  aqiPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  aqiPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  aqiHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  aqiBigNum: {
    fontSize: 48,
    fontWeight: "900",
  },
  aqiDescText: {
    color: "#cccccc",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  aqiBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  aqiBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  pollutantGridTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  pollutantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  pollutantItem: {
    width: "31%",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pollutantName: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: "700",
  },
  pollutantVal: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  footerNote: {
    textAlign: "center",
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    marginTop: 25,
    marginBottom: 10,
  },
});