// app/(tabs)/aqi.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "../../components/ui/AppBlurView";
import { useRouter } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { fetchAirPollution, parseRefreshIntervalMs } from "../../lib/WeatherService";
import { useAppSettings } from "../../contexts/AppSettingsContext";

export default function AqiDetailScreen() {
  const router = useRouter();
  const { highPollutionAlerts, refreshInterval } = useAppSettings();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [station, setStation] = useState("Local Ambient Sensor");
  const [locationName, setLocationName] = useState("Locating...");
  const [aqiData, setAqiData] = useState({
    value: 48,
    status: "Good",
    color: "#10b981",
    advisory: "Air quality is satisfactory. Enjoy outdoor activities.",
    lastUpdated: "Just now",
    pollutants: {
      NH3: 4,
      PM25: 14,
      SO2: 6,
      CO: 0.3,
      PM10: 28,
      NO2: 9,
      OZONE: 22,
    },
  });

  const loadAqiData = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      let lat = 28.6139; // Default fallback Delhi coords
      let lon = 77.2090;

      if (permission.status === "granted") {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;

          // Reverse geocode for accurate locality
          const geocoded = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lon,
          });
          if (geocoded.length > 0) {
            const place = geocoded[0];
            const city = place.city || place.subregion || place.district || "Local Region";
            const region = place.region || place.country || "";
            setLocationName(`${city}${region ? `, ${region}` : ""}`);
            setStation(`${city} Central Monitoring Station`);
          }
        } catch (e) {
          console.log("AQI location geocode error:", e);
        }
      }

      const cacheAge = parseRefreshIntervalMs(refreshInterval);
      const data = await fetchAirPollution(lat, lon, cacheAge);

      setAqiData({
        value: data.value,
        status: data.status,
        color: data.color,
        advisory: data.advisory,
        lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        pollutants: data.pollutants,
      });
    } catch (err) {
      console.log("Error loading AQI:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshInterval]);

  useEffect(() => {
    loadAqiData();
  }, [loadAqiData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAqiData();
  };

  const isHighPollution = highPollutionAlerts && aqiData.value > 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* TOP HEADER BAR */}
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.topBarTitle}>Air Quality Index</Text>
        <Pressable style={styles.refreshIconBtn} onPress={onRefresh}>
          <Feather name="refresh-cw" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={["#10b981"]}
          />
        }
      >
        {/* TOP SHEET CONTAINER WITH BLUR/GRADIENT LOOK */}
        <BlurView intensity={35} tint="dark" style={styles.sheet}>
          <View style={styles.dragHandle} />

          {/* HEADER SECTION */}
          <View style={styles.header}>
            <Text style={styles.titleText}>Live Air Monitoring</Text>
            <Text style={styles.stationText}>Station: {station}</Text>
          </View>

          {/* HIGH POLLUTION ALERT BANNER */}
          {isHighPollution && (
            <View style={styles.alertCard}>
              <Feather name="alert-triangle" size={16} color="#f97316" />
              <Text style={styles.alertCardText}>
                High Pollution Advisory: AQI {aqiData.value} is {aqiData.status}. Sensitive groups should minimize outdoor exposure and wear protective masks.
              </Text>
            </View>
          )}

          {/* MAIN INDEX HERO */}
          <View style={styles.mainIndexContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#10b981" style={{ marginVertical: 30 }} />
            ) : (
              <>
                <Text style={[styles.mainIndex, { color: aqiData.color }]}>
                  {aqiData.value}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${aqiData.color}22`, borderColor: aqiData.color },
                  ]}
                >
                  <Text style={[styles.mainStatus, { color: aqiData.color }]}>
                    {aqiData.status}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* LOCATION INFORMATION SECTION */}
          <Text style={styles.sectionTitle}>LOCATION INFORMATION</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City & Region</Text>
            <Text style={styles.infoValue}>{locationName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Updated</Text>
            <Text style={styles.infoValue}>{aqiData.lastUpdated}</Text>
          </View>

          {/* REAL-TIME POLLUTANTS GRID SECTION */}
          <Text style={styles.sectionTitle}>REAL-TIME POLLUTANTS</Text>
          <View style={styles.grid}>
            <PollutantCard label="PM2.5" value={`${aqiData.pollutants.PM25}`} unit="µg/m³" />
            <PollutantCard label="PM10" value={`${aqiData.pollutants.PM10}`} unit="µg/m³" />
            <PollutantCard label="NO2" value={`${aqiData.pollutants.NO2}`} unit="µg/m³" />
            <PollutantCard label="O3" value={`${aqiData.pollutants.OZONE}`} unit="µg/m³" />
            <PollutantCard label="CO" value={`${aqiData.pollutants.CO}`} unit="mg/m³" />
            <PollutantCard label="SO2" value={`${aqiData.pollutants.SO2}`} unit="µg/m³" />
            <PollutantCard label="NH3" value={`${aqiData.pollutants.NH3}`} unit="µg/m³" />
          </View>

          {/* HEALTH ADVISORY CARD SECTION */}
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <Feather name="shield" size={16} color={aqiData.color} />
              <Text style={styles.advisoryTitle}>Health Advisory</Text>
            </View>
            <Text style={styles.advisoryText}>{aqiData.advisory}</Text>
          </View>

          <Text style={styles.footerText}>
            Standard US EPA AQI Scale • Updated every {refreshInterval}
          </Text>
        </BlurView>
      </ScrollView>
    </SafeAreaView>
  );
}

// Grid Card Component for Pollutants
function PollutantCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.pCard}>
      <Text style={styles.pLabel}>{label}</Text>
      <Text style={styles.pValue}>{value}</Text>
      {unit ? <Text style={styles.pUnit}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#080910" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: { paddingBottom: 60, marginTop: 10 },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    padding: 20,
    backgroundColor: "rgba(20, 24, 33, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  header: { marginBottom: 20 },
  titleText: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  stationText: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 4 },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderColor: "rgba(249, 115, 22, 0.4)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  alertCardText: {
    color: "#fdba74",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    flex: 1,
  },
  mainIndexContainer: { alignItems: "center", marginBottom: 30 },
  mainIndex: { fontSize: 76, fontWeight: "900", letterSpacing: -1 },
  statusPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },
  mainStatus: { fontSize: 14, fontWeight: "800", textTransform: "uppercase" },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  infoLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  infoValue: { color: "#fff", fontSize: 12, fontWeight: "700" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  pCard: {
    width: "31%",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  pLabel: { color: "rgba(255,255,255,0.5)", fontSize: 9.5, fontWeight: "700", marginBottom: 4 },
  pValue: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  pUnit: { color: "rgba(255,255,255,0.4)", fontSize: 8, marginTop: 2 },
  advisoryCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginTop: 10,
  },
  advisoryHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  advisoryTitle: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  advisoryText: { color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 18 },
  footerText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    textAlign: "center",
    marginTop: 30,
    fontWeight: "600",
  },
});