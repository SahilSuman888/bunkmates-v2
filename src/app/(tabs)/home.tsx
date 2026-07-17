import React, { useEffect, useState, useMemo } from "react";
import Animated from "../reanimatedShim";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  Text,
  StatusBar,
  Dimensions,
  ImageBackground,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { db } from "../../lib/firebase";
import { 
  collection, 
  query, 
  where,
  onSnapshot,
  updateDoc,
  setDoc,
  increment,
  arrayUnion,
  arrayRemove,
  getDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";



// Components
import { fetchCurrentWeather } from "../../lib/WeatherService";
import WeatherDetailsSheet from "./Weather/WeatherDetailsSheet";

// Import the JSON data
import placesData from "../data/data.json";

const { width } = Dimensions.get("window");

const generateAllPlaces = () =>
  placesData.states.flatMap(state =>
    state.districts.flatMap(district =>
      district.places.map(place => ({
        ...place,
        districtName: district.name,
        stateName: state.name,
        placeId: `${place.name.replace(/\s+/g, "_")}_${state.name}_${district.name}`,
      }))
    )
  );

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, userData } = useUser();

  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<any>(null);
  const [aqiValue, setAqiValue] = useState<number>(70);
  
  // Firestore Data States
  const [trips, setTrips] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [likesData, setLikesData] = useState<any>({});
  const [unreadCount, setUnreadCount] = useState(0); // Track unread notification count

  // UI States
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const [activeTripIndex, setActiveTripIndex] = useState(0);

  const allPlaces = useMemo(() => generateAllPlaces(), []);
  const featuredPlace = useMemo(() => allPlaces[0], [allPlaces]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    setLoading(false);
  }, [user, authLoading]);

  // ...existing code...

  /* ================= FIRESTORE REAL-TIME DATA ================= */
  useEffect(() => {
    if (!user) return;

    const tripsQuery = query(
      collection(db, "trips"),
      where("members", "array-contains", user.uid)
    );

    const unsubTrips = onSnapshot(tripsQuery, (snapshot) => {
      const tripList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      tripList.sort((a, b) => {
        const dateA = new Date(a.startDate || 0).getTime();
        const dateB = new Date(b.startDate || 0).getTime();
        return dateB - dateA;
      });

      // enrich with groupChat iconURL if available
      (async () => {
        try {
          const enriched = await Promise.all(
            tripList.map(async (t) => {
              try {
                const q = query(collection(db, "groupChats"), where("tripId", "==", t.id));
                const snap = await getDocs(q);
                if (!snap.empty) {
                  const g = snap.docs[0].data();
                  return { ...t, iconURL: g.iconURL || t.iconURL };
                }
              } catch (e) {
                console.error("groupChat lookup failed", e);
              }
              return t;
            })
          );
          setTrips(enriched);
        } catch (e) {
          console.error(e);
          setTrips(tripList);
        }
      })();
    });

    const remindersQuery = query(
      collection(db, "reminders"),
      where("uid", "==", user.uid)
    );

    const unsubReminders = onSnapshot(remindersQuery, (snapshot) => {
      const reminderList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];

      reminderList.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateA - dateB;
      });

      setReminders(reminderList);
    });

    return () => {
      unsubTrips();
      unsubReminders();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !allPlaces.length) return;
    const unsubscribes: any[] = [];
    allPlaces.forEach((place) => {
      const ref = doc(db, "places", place.placeId);
      const unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          setLikesData((prev: any) => ({ ...prev, [place.placeId]: snap.data() }));
        } else {
          setLikesData((prev: any) => ({ ...prev, [place.placeId]: { likesCount: 0, likedBy: [] } }));
        }
      });
      unsubscribes.push(unsub);
    });
    return () => unsubscribes.forEach((u) => u());
  }, [user, allPlaces]);

  const handleLike = async (place: any) => {
    if (!user) return;
    const ref = doc(db, "places", place.placeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { likesCount: 1, likedBy: [user.uid], updatedAt: new Date() });
      return;
    }
    const data = snap.data();
    const alreadyLiked = data.likedBy?.includes(user.uid);
    if (alreadyLiked) {
      await updateDoc(ref, { likesCount: increment(-1), likedBy: arrayRemove(user.uid) });
    } else {
      await updateDoc(ref, { likesCount: increment(1), likedBy: arrayUnion(user.uid) });
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      const data = await fetchCurrentWeather(loc.coords.latitude, loc.coords.longitude);
      setWeather(data);
      try {
        const res = await fetch("https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=579b464db66ec23bdd0000011c04ccafb50742ba6a0a7d5e22aa498e&format=json&limit=1");
        const json = await res.json();
        if (json.records?.length > 0) {
           setAqiValue(parseInt(json.records[0].avg_value) || 70);
        }
      } catch (e) { console.log("AQI Fetch error", e) }
    })();
  }, []);

  const handleScroll = (event: any) => {
    const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    if (slide !== activeTripIndex) {
      setActiveTripIndex(slide);
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00f721" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          
          {/* 1. HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Good Night,</Text>
              <Text style={styles.name}>{userData?.name || user?.displayName || "Mohit Sharma"}</Text>
            </View>
            <NotificationBell />
          </View>

          {/* 2. WEATHER & AQI ROW */}
          <View style={styles.weatherAqiRow}>
            <Pressable style={styles.weatherInfo} onPress={() => setShowWeatherDetails(true)}>
              <MaterialCommunityIcons name="white-balance-sunny" size={32} color="#FFD700" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.tempText}>{Math.round(weather?.main?.temp || 22)}°C - {weather?.name || "Chittaurgarh"}</Text>
                <Text style={styles.subText}>{weather?.weather[0]?.description || "clear sky"}</Text>
              </View>
            </Pressable>

            <Pressable style={styles.aqiBadge} onPress={() => router.push("/(tabs)/aqi")}>
               <Text style={styles.aqiNumber}>{aqiValue}</Text>
               <Text style={styles.aqiLabel}>AQI • Moderate</Text>
               <Feather name="info" size={10} color="#fff" style={styles.infoIcon} />
            </Pressable>
          </View>

          {/* 3. SEARCH BAR */}
          <Pressable 
            style={styles.searchBar}
            onPress={() => router.push("/search")}
          >
            <Ionicons name="search-outline" size={20} color="#fff" />
            <Text style={styles.searchText}>Search Exploration</Text>
          </Pressable>

          {/* 4. YOUR TRIPS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Trips</Text>
            <Pressable onPress={() => router.push("/(tabs)/trips")}>
                <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
          
          <View>
            <FlatList
                data={trips}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Pressable 
                      onPress={() => router.push({ pathname: "/(tabs)/trips", params: { tripId: item.id } })}
                        style={styles.tripCardContainer}
                    >
                      <ImageBackground 
                        source={{ uri: item.iconURL || 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3' }} 
                            style={styles.tripCard}
                            imageStyle={{ borderRadius: 20 }}
                        >
                          <Pressable
                            style={styles.likeButton}
                            onPress={() => handleLike(item)}
                          >
                            <Ionicons
                              name={
                                likesData[item.id]?.likedBy?.includes(user?.uid)
                                  ? "heart"
                                  : "heart-outline"
                              }
                              size={18}
                              color="#fff"
                            />
                            <Text style={styles.likeText}>
                              {likesData[item.id]?.likesCount || 0}
                            </Text>
                          </Pressable>
                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.tripGradient}>
                                <View style={styles.tripContent}>
                                    <View style={styles.tripMainRow}>
                                        <Text style={styles.tripTitle}>{item.name}</Text>
                                        <View style={styles.avatarGroup}>
                                            <View style={[styles.miniAvatar, { backgroundColor: '#d1a3ff' }]} />
                                            <Image source={{ uri: userData?.photoURL || user?.photoURL || "https://i.pravatar.cc/150?img=11" }} style={styles.miniAvatar} />
                                        </View>
                                    </View>
                                    <Text style={styles.tripSub}><Ionicons name="location-sharp" size={12} /> {item.from} → {item.location}</Text>
                                    <Text style={styles.tripSub}><Ionicons name="time-outline" size={12} /> {item.startDate} → {item.endDate || '?'}</Text>
                                    <Text style={styles.progressText}>Timeline Progress: 0 / 1 complete</Text>
                                    <View style={styles.progressBarBg}><View style={styles.progressBarFill} /></View>
                                </View>
                            </LinearGradient>
                        </ImageBackground>
                    </Pressable>
                )}
            />
            <View style={styles.paginationDots}>
                {trips.map((_, index) => (
                    <View 
                        key={index} 
                        style={[
                            styles.dot, 
                            { backgroundColor: activeTripIndex === index ? '#fff' : 'rgba(255,255,255,0.3)' }
                        ]} 
                    />
                ))}
            </View>
          </View>

          {/* 5. REMINDERS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Reminders</Text>
            <Pressable onPress={() => router.push("/(tabs)/reminders")}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 20 }}>
            {reminders.length > 0 ? reminders.map((item) => (
              <ReminderCard 
                key={item.id}
                title={item.text} 
                date={`${item.date} • ${item.time}`} 
                color={item.completed ? "#00f721" : "#3b82f6"} 
                completed={item.completed} 
              />
            )) : (
              <Text style={{ color: '#aaa' }}>No reminders found.</Text>
            )}
          </ScrollView>

          {/* 6. FEATURED PLACES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Places</Text>
          </View>
          {allPlaces && allPlaces.length > 0 ? (
            <FlatList
              data={allPlaces.slice(0, 6)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.placeId}
              contentContainerStyle={{ paddingLeft: 20 }}
              renderItem={({ item }) => (
                <PlaceCard
                  place={item}
                  isLiked={likesData[item.placeId]?.likedBy?.includes(user?.uid)}
                  likesCount={likesData[item.placeId]?.likesCount || 0}
                  onLike={() => handleLike(item)}
                  onPress={() => router.push({ pathname: "/(tabs)/place-details", params: { placeId: item.placeId } })}
                />
              )}
            />
          ) : (
            <Text style={{ color: '#aaa', paddingHorizontal: 20 }}>No featured places available.</Text>
          )}

          {/* 7. MORE PLACES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>More Places</Text>
          </View>
            <FlatList
            data={allPlaces.slice(1)}
            scrollEnabled={false}
            keyExtractor={(item) => item.placeId}
            renderItem={({ item }) => (
              <PlaceCard 
                place={item}
                isLiked={likesData[item.placeId]?.likedBy?.includes(user?.uid)}
                likesCount={likesData[item.placeId]?.likesCount || 0}
                onLike={() => handleLike(item)}
                onPress={() => router.push({ pathname: "/(tabs)/place-details", params: { placeId: item.placeId } })}
              />
            )}
          />

        </ScrollView>

        <WeatherDetailsSheet 
          weather={weather} 
          visible={showWeatherDetails} 
          onClose={() => setShowWeatherDetails(false)} 
        />
      </View>
    </SafeAreaView>
  );
}

function PlaceCard({ place, isLiked, likesCount, onLike, onPress }: any) {
  const router = useRouter();

  return (
    <Pressable style={[styles.placeCard, { width: 260, marginRight: 12 }]} onPress={onPress}>
      <ImageBackground
        source={{ uri: place.images[0] }}
        style={styles.placeCardImage}
        imageStyle={{ borderRadius: 16 }}
      >
        <Pressable
          style={styles.placeLikeButton}
          onPress={(e) => {
            e.stopPropagation();
            onLike();
          }}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color="#fff"
          />
          <Text style={styles.placeCardLikeCount}>{likesCount}</Text>
        </Pressable>

        <Pressable
          style={styles.createTripButton}
          onPress={(e) => {
            e.stopPropagation();
            router.push({ pathname: "/(tabs)/trips", params: { createFromPlace: place.placeId } });
          }}
        >
          <Text style={styles.createTripText}>PLAN THIS TRIP</Text>
        </Pressable>
      </ImageBackground>
      <View style={styles.placeInfoContainer}>
        <Text style={styles.placeTitle}>{place.name}</Text>
        <Text style={styles.placeDistrict}>{place.districtName}, {place.stateName}</Text>
        <Text style={styles.placeDescription} numberOfLines={2}>{place.description}</Text>
      </View>
    </Pressable>
  );
}

function ReminderCard({ title, date, color, completed }: any) {
  return (
    <View style={styles.remCard}>
      <View style={styles.remHeader}>
        <View style={[styles.remDot, { borderColor: color }]} />
        {completed && <Ionicons name="checkmark-circle" size={18} color="#00f721" />}
      </View>
      <Text style={styles.remTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.remDate}>{date}</Text>
      <MaterialCommunityIcons name="calendar-blank-outline" size={40} color="rgba(255,255,255,0.05)" style={styles.remIconBg} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#080910" },
  container: { flex: 1, backgroundColor: "#080910" },
  center: { justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingTop: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { color: "#fff", opacity: 0.8, fontSize: 15 },
  name: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  bell: { padding: 8, backgroundColor: "#1c1c1e", borderRadius: 20 },
  notificationDot: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, backgroundColor: '#ff4d4d', borderRadius: 9, borderWidth: 1, borderColor: '#000', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notificationCount: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  weatherAqiRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 25, justifyContent: 'space-between', alignItems: 'center' },
  weatherInfo: { flexDirection: 'row', alignItems: 'center' },
  tempText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#aaa', fontSize: 12 },
  aqiBadge: { backgroundColor: 'rgba(0, 150, 100, 0.2)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0, 255, 150, 0.3)', alignItems: 'center' },
  aqiNumber: { color: '#00f7a5', fontSize: 24, fontWeight: 'bold' },
  aqiLabel: { color: '#00f7a5', fontSize: 9, fontWeight: 'bold' },
  infoIcon: { position: 'absolute', top: 4, right: 4 },
  searchBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', margin: 20, padding: 12, borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchText: { color: '#fff', marginLeft: 10, opacity: 0.8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 20, marginBottom: 15 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  viewAll: { color: '#ff9f43', fontSize: 12 },
  tripCardContainer: { width: width, paddingHorizontal: 20 },
  tripCard: { height: 200, borderRadius: 20, overflow: 'hidden' },
  tripGradient: { flex: 1, justifyContent: 'flex-end', padding: 15 },
  tripTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  tripMainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarGroup: { flexDirection: 'row' },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, marginLeft: -8, borderWidth: 1, borderColor: '#000' },
  tripSub: { color: '#ccc', fontSize: 11, marginTop: 2 },
  progressText: { color: '#fff', fontSize: 10, marginTop: 15, opacity: 0.8 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 5 },
  progressBarFill: { width: '30%', height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  paginationDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  dot: { width: 16, height: 4, borderRadius: 2, marginHorizontal: 3 },
  tripContent: { flex: 1, justifyContent: 'flex-end', padding: 15 },
  likeButton: { position: 'absolute', top: 15, right: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  likeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  remCard: { width: 140, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 15, marginRight: 15, overflow: 'hidden' },
  remHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  remDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  remTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  remDate: { color: '#888', fontSize: 10, marginTop: 4 },
  remIconBg: { position: 'absolute', bottom: -5, right: -5 },
  featuredCard: { marginHorizontal: 20, borderRadius: 20, backgroundColor: '#1c1c1e', overflow: 'hidden' },
  featuredImg: { width: '100%', height: 200 },
  featuredLikeButton: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6, justifyContent: 'center' },
  likeCountText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  featuredTextContainer: { padding: 15 },
  featuredTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  featuredDesc: { color: '#aaa', fontSize: 11, marginTop: 5 },
  placeCard: { marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1c1c1e' },
  placeCardImage: { width: '100%', height: 180 },
  placeLikeButton: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4, justifyContent: 'center' },
  placeCardLikeCount: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  placeInfoContainer: { padding: 12 },
  placeTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  placeDistrict: { color: '#aaa', fontSize: 11, marginTop: 2 },
  placeDescription: { color: '#888', fontSize: 10, marginTop: 4 },
  createTripButton: { position: 'absolute', bottom: 14, left: 14, backgroundColor: '#ff9f43', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  createTripText: { color: '#000', fontWeight: '700', fontSize: 12 },
});