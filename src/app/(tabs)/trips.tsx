import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
collection,
query,
where,
onSnapshot,
getDocs,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { Ionicons } from "@expo/vector-icons";

import TripCard from "../../components/trips/TripCard";
import HorizontalCalendar from "../../components/trips/HorizontalCalendar";
import CreateTripSheet from "../../components/trips/CreateTripSheet";
import placesData from "../data/data.json";

function findPlaceById(placeId: string | undefined) {
  if (!placeId) return null;
  const all = placesData.states.flatMap(s => s.districts.flatMap(d => d.places.map(p => ({ ...p, districtName: d.name, stateName: s.name, placeId: `${p.name.replace(/\s+/g, "_")}_${s.name}_${d.name}` }))))
  return all.find(p => p.placeId === placeId) || null;
}

export default function Trips() {
const router = useRouter();
const params = useLocalSearchParams();
const createFromPlace = params?.createFromPlace as string | undefined;
const user = auth.currentUser;

const [trips, setTrips] = useState<any[]>([]);
const [showPast, setShowPast] = useState(false);
const [createOpen, setCreateOpen] = useState(false);
const [initialPlace, setInitialPlace] = useState<any>(null);

useEffect(() => {
  if (createFromPlace) {
    const p = findPlaceById(createFromPlace);
    if (p) {
      setInitialPlace(p);
      setCreateOpen(true);
    }
  }
}, [createFromPlace]);

useEffect(() => {
if (!user?.uid) return;

const q = query(
  collection(db, "trips"),
  where("members", "array-contains", user.uid)
);

const unsubscribe = onSnapshot(q, async (snapshot) => {
  const tripList = await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();

      const trip: any = {
        id: docSnap.id,
        ...data,
      };

      try {
        const timelineSnap = await getDocs(
          collection(db, "trips", trip.id, "timeline")
        );

        const events = timelineSnap.docs.map((d) => d.data());

        const total = events.length || 1;
        const completed = events.filter((e: any) => e?.completed).length;

        trip.timelineStats = { total, completed };
        trip.timelineProgress = Math.round((completed / total) * 100);
      } catch {
        trip.timelineStats = { total: 0, completed: 0 };
        trip.timelineProgress = 0;
      }

      if (!trip?.budget) {
        trip.budget = { total: 0, used: 0 };
      }

      return trip;
    })
  );

  setTrips(tripList);
});

return unsubscribe;

}, [user]);

const today = new Date();

const upcomingTrips = trips.filter((t) => {
const date = new Date(t?.endDate || t?.startDate || today);
return date >= today;
});

const pastTrips = trips.filter((t) => {
const date = new Date(t?.endDate || t?.startDate || today);
return date < today;
});

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Your Trips</Text>
      </View>

      <HorizontalCalendar trips={trips} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        <Text style={styles.section}>Upcoming Trips</Text>

        {upcomingTrips.length === 0 ? (
          <Text style={styles.empty}>No upcoming trips</Text>
        ) : (
          upcomingTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onPress={() => router.push(`/trips/TripDetails?id=${trip.id}` as any)}
            />
          ))
        )}

        {pastTrips.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <TouchableOpacity onPress={() => setShowPast((v) => !v)}>
              <Text style={styles.section}>Past Trips {showPast ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showPast &&
              pastTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onPress={() => router.push(`/trips/TripDetails?id=${trip.id}` as any)}
                />
              ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>

      <CreateTripSheet visible={createOpen} onClose={() => setCreateOpen(false)} initialPlace={initialPlace} />
    </View>
  );
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#080910",
},
header: {
paddingHorizontal: 20,
paddingTop: 20,
marginBottom: 10,
},
title: {
fontSize: 24,
color: "#fff",
fontWeight: "bold",
},
section: {
color: "#fff",
fontSize: 18,
fontWeight: "600",
marginBottom: 10,
},
empty: {
color: "#777",
marginBottom: 20,
},
fab: {
position: "absolute",
bottom: 40,
right: 20,
width: 56,
height: 56,
borderRadius: 28,
backgroundColor: "#00f721",
justifyContent: "center",
alignItems: "center",
elevation: 5,
},
});
