import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Text,
  StatusBar,
  ImageBackground,
  Dimensions,
  FlatList,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUser } from "../../contexts/UserContext";
import { db } from "../../lib/firebase";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  increment,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import placesData from "../data/data.json";

const { width } = Dimensions.get("window");

export default function PlaceDetails() {
  const router = useRouter();
  const { placeId } = useLocalSearchParams();
  const { user } = useUser();

  const [place, setPlace] = useState<any>(null);
  const [likesData, setLikesData] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Find place from JSON
  useEffect(() => {
    if (!placeId) return;

    const allPlaces = placesData.states.flatMap(state =>
      state.districts.flatMap(district =>
        district.places.map(place => ({
          ...place,
          districtName: district.name,
          stateName: state.name,
          placeId: `${place.name.replace(/\s+/g, "_")}_${state.name}_${district.name}`,
        }))
      )
    );

    const foundPlace = allPlaces.find(p => p.placeId === placeId);
    if (foundPlace) {
      setPlace(foundPlace);
    }
  }, [placeId]);

  // Listen to Firebase likes
  useEffect(() => {
    if (!placeId) return;

    const ref = doc(db, "places", placeId as string);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setLikesData(snap.data());
      } else {
        setLikesData({ likesCount: 0, likedBy: [] });
      }
    });

    return () => unsub();
  }, [placeId]);

  const handleLike = async () => {
    if (!user || !placeId) return;

    const ref = doc(db, "places", placeId as string);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        likesCount: 1,
        likedBy: [user.uid],
        updatedAt: new Date(),
      });
      return;
    }

    const data = snap.data();
    const alreadyLiked = data.likedBy?.includes(user.uid);

    if (alreadyLiked) {
      await updateDoc(ref, {
        likesCount: increment(-1),
        likedBy: arrayRemove(user.uid),
      });
    } else {
      await updateDoc(ref, {
        likesCount: increment(1),
        likedBy: arrayUnion(user.uid),
      });
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    Alert.alert(isSaved ? "Removed from Wishlist" : "Added to Wishlist");
  };

  if (!place) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: "#fff", textAlign: "center", marginTop: 20 }}>
          Place not found
        </Text>
      </SafeAreaView>
    );
  }

  const isLiked = likesData?.likedBy?.includes(user?.uid);
  const likesCount = likesData?.likesCount || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header with close button */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={handleSave} style={styles.saveBtn}>
              <MaterialCommunityIcons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={22}
                color="#fff"
              />
            </Pressable>
          </View>

          {/* Image carousel */}
          <View style={styles.imageContainer}>
            <ImageBackground
              source={{ uri: place.images[currentImageIndex] }}
              style={styles.image}
              imageStyle={{ borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}
            >
              <Pressable
                style={styles.likeButton}
                onPress={handleLike}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.likeCountBig}>{likesCount}</Text>
              </Pressable>
            </ImageBackground>

            {/* Image dots */}
            {place.images.length > 1 && (
              <View style={styles.imageDots}>
                {place.images.map((_, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setCurrentImageIndex(index)}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          currentImageIndex === index ? "#fff" : "rgba(255,255,255,0.4)",
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Place Info */}
          <View style={styles.contentContainer}>
            {/* Title and Type */}
            <View style={styles.titleSection}>
              <View>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeLocation}>
                  {place.districtName}, {place.stateName}
                </Text>
              </View>
            </View>

            {/* Type and Rating */}
            <View style={styles.metaRow}>
              <View style={styles.typeTag}>
                <Text style={styles.typeText}>{place.type}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>1</Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.description}>{place.description}</Text>
            </View>

            {/* Best Time and Weather */}
            <View style={styles.infoGrid}>
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="calendar-month" size={20} color="#00f7a5" />
                <Text style={styles.infoLabel}>Best Time</Text>
                <Text style={styles.infoValue}>{place.bestTimeToVisit}</Text>
              </View>
              <View style={styles.infoBox}>
                <Ionicons name="cloudy" size={20} color="#FFD700" />
                <Text style={styles.infoLabel}>Season</Text>
                <Text style={styles.infoValue}>{place.season}</Text>
              </View>
            </View>

            {/* Weather */}
            <View style={styles.weatherBox}>
              <Ionicons name="cloud-outline" size={20} color="#87CEEB" />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.weatherLabel}>Weather</Text>
                <Text style={styles.weatherValue}>{place.weather}</Text>
              </View>
            </View>

            {/* Nearest Attractions */}
            {place.nearestAttractions && place.nearestAttractions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nearby Attractions</Text>
                <FlatList
                  data={place.nearestAttractions}
                  scrollEnabled={false}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={({ item }) => (
                    <View style={styles.attractionCard}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.attractionImage}
                      />
                      <View style={styles.attractionInfo}>
                        <Text style={styles.attractionName}>{item.name}</Text>
                        <Text style={styles.attractionDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            )}

            {/* Plan Trip Button */}
            <Pressable
              style={styles.planTripButton}
              onPress={() => router.push({ pathname: "/(tabs)/trips", params: { createFromPlace: place.placeId } })}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#000" />
              <Text style={styles.planTripText}>Plan this Trip</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#080910" },
  container: { flex: 1, backgroundColor: "#080910" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: { position: "relative", marginBottom: 10 },
  image: { width: "100%", height: 280 },
  likeButton: {
    position: "absolute",
    bottom: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  likeCountBig: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  imageDots: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  dot: { width: 20, height: 4, borderRadius: 2 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  titleSection: { marginBottom: 16 },
  placeName: { color: "#fff", fontSize: 26, fontWeight: "bold" },
  placeLocation: { color: "#aaa", fontSize: 13, marginTop: 4 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 10,
  },
  typeTag: {
    backgroundColor: "rgba(0,247,165,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,247,165,0.3)",
  },
  typeText: { color: "#00f7a5", fontSize: 12, fontWeight: "bold" },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,215,0,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  ratingText: { color: "#FFD700", fontSize: 12, fontWeight: "bold" },
  section: { marginBottom: 24 },
  description: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  infoBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  infoLabel: { color: "#aaa", fontSize: 11, marginTop: 6 },
  infoValue: { color: "#fff", fontSize: 12, fontWeight: "bold", marginTop: 2 },
  weatherBox: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  weatherLabel: { color: "#aaa", fontSize: 11 },
  weatherValue: { color: "#fff", fontSize: 13, fontWeight: "500" },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  attractionCard: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  attractionImage: { width: 100, height: 100 },
  attractionInfo: { flex: 1, padding: 12 },
  attractionName: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  attractionDesc: { color: "#aaa", fontSize: 11, marginTop: 4 },
  planTripButton: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
  },
  planTripText: { color: "#000", fontSize: 16, fontWeight: "bold" },
});
