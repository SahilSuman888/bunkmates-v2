// app/(tabs)/aqi.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "../../components/ui/AppBlurView";
import { useRouter } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";

export default function AqiDetailScreen() {
  const router = useRouter();

  // Temporary mock data for UI design - replace with API data later
  const [aqiData, setAqiData] = useState({
    value: 70,
    status: "Moderate",
    station: "Gulzarpet, Anantapur - APPCB",
    location: "Anantapur, Andhra Pradesh",
    lastUpdated: "Just now",
    pollutants: {
      NH3: 5,
      PM25: 66,
      SO2: 13,
      CO: 17,
      PM10: 70,
      NO2: 22,
      OZONE: 34,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        
        {/* TOP SHEET CONTAINER WITH BLUR/GRADIENT LOOK */}
        <BlurView intensity={30} tint="dark" style={styles.sheet}>
          <View style={styles.dragHandle} />
          
          {/* HEADER SECTION (A) */}
          <View style={styles.header}>
            <Text style={styles.titleText}>Air Quality Index</Text>
            <Text style={styles.stationText}>Station: {aqiData.station}</Text>
          </View>

          <View style={styles.mainIndexContainer}>
            <Text style={styles.mainIndex}>{aqiData.value}</Text>
            <Text style={styles.mainStatus}>{aqiData.status}</Text>
          </View>

          {/* LOCATION INFORMATION SECTION (B) */}
          <Text style={styles.sectionTitle}>LOCATION INFORMATION</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City & State</Text>
            <Text style={styles.infoValue}>{aqiData.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Updated</Text>
            <Text style={styles.infoValue}>{aqiData.lastUpdated}</Text>
          </View>

          {/* REAL-TIME POLLUTANTS GRID SECTION (C) */}
          <Text style={styles.sectionTitle}>REAL-TIME POLLUTANTS</Text>
          <View style={styles.grid}>
            <PollutantCard label="NH3" value={aqiData.pollutants.NH3} />
            <PollutantCard label="PM2.5" value={aqiData.pollutants.PM25} />
            <PollutantCard label="SO2" value={aqiData.pollutants.SO2} />
            <PollutantCard label="CO" value={aqiData.pollutants.CO} />
            <PollutantCard label="PM10" value={aqiData.pollutants.PM10} />
            <PollutantCard label="NO2" value={aqiData.pollutants.NO2} />
            <PollutantCard label="OZONE" value={aqiData.pollutants.OZONE} />
          </View>

          {/* HEALTH ADVISORY CARD SECTION (D) */}
          <View style={styles.advisoryCard}>
            <View style={styles.advisoryHeader}>
              <Feather name="info" size={16} color="#00f721" />
              <Text style={styles.advisoryTitle}>Health Advisory</Text>
            </View>
            <Text style={styles.advisoryText}>
              Sensitive individuals should consider reducing prolonged outdoor exertion.
            </Text>
          </View>

          <Text style={styles.footerText}>Data source updated at Just now</Text>
        </BlurView>
      </ScrollView>

      {/* BACK BUTTON */}
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

// Grid Card Component for Pollutants
function PollutantCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.pCard}>
      <Text style={styles.pLabel}>{label}</Text>
      <Text style={styles.pValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#080910" },
  container: { paddingBottom: 60, marginTop: 40 },
  sheet: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', padding: 20 },
  dragHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { marginBottom: 30 },
  titleText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  stationText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4 },
  mainIndexContainer: { alignItems: 'center', marginBottom: 40 },
  mainIndex: { color: '#00f7a5', fontSize: 80, fontWeight: 'bold' },
  mainStatus: { color: '#00f7a5', fontSize: 20, fontWeight: '600' },
  sectionTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  infoValue: { color: '#fff', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginBottom: 20 },
  pCard: { width: '18%', backgroundColor: 'rgba(255,255,255,0.06)', padding: 12, borderRadius: 12, marginBottom: 10, marginRight: '2%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  pLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginBottom: 5 },
  pValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  advisoryCard: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginTop: 15 },
  advisoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  advisoryTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  advisoryText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 },
  footerText: { color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginTop: 50 },
  backButton: { position: 'absolute', top: 50, left: 15, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 25 },
});