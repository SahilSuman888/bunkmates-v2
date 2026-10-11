import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Text,
  Modal,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "../contexts/UserContext";
import { db } from "../lib/firebase";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { MotiView } from "moti";
import placesData from "./data/data.json";
import { searchTravelEngine, getFallbackPhoto } from "../services/travelSearchEngine";

const { width } = Dimensions.get("window");


export default function SearchScreen() {
  const router = useRouter();
  const { user } = useUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [results, setResults] = useState<{
    users: any[];
    places: any[];
    food: any[];
    trips: any[];
  }>({ users: [], places: [], food: [], trips: [] });
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<"user" | "place" | null>(null);

  // Get all places from data.json
  const allPlaces = useMemo(() => {
    return placesData.states.flatMap(state =>
      state.districts.flatMap(district =>
        district.places.map(place => ({
          ...place,
          districtName: district.name,
          stateName: state.name,
          placeId: `${place.name.replace(/\s+/g, "_")}_${state.name}_${district.name}`,
          city: district.name,
          state: state.name,
        }))
      )
    );
  }, []);

  // Perform search
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setResults({ users: [], places: [], food: [], trips: [] });
        return;
      }

      setLoading(true);
      try {
        const term = searchQuery.toLowerCase();

        // 1. Search Users
        const usersSnap = await getDocs(collection(db, "users"));
        const userResults = usersSnap.docs
          .map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() } as any))
          .filter(u => {
            const searchIn = [(u as any).name, (u as any).email, (u as any).username]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return searchIn.includes(term);
          });

        // 2. Search Static Places from JSON
        const staticPlaceResults = allPlaces.filter(p => {
          const searchIn = [p.name, p.districtName, p.stateName, p.description]
            .join(" ")
            .toLowerCase();
          return searchIn.includes(term);
        });

        // 3. Search Trips
        let tripResults: any[] = [];
        if (user) {
          const tripsSnap = await getDocs(
            query(collection(db, "trips"), where("owner", "==", user.uid))
          );
          tripResults = tripsSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(t => {
              const searchIn = [(t as any).name, (t as any).from, (t as any).location]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return searchIn.includes(term);
            });
        }

        // 4. BunkMates Intelligent Travel & Food Engine (Gemini Flash-Lite + Wikimedia + Curated)
        let discoveryPlaces: any[] = [];
        let discoveryFood: any[] = [];

        if (term.length >= 3) {
          try {
            const engineCategory = activeTab === "food" ? "food" : activeTab === "places" ? "places" : "all";
            const engineResponse = await searchTravelEngine(
              searchQuery,
              engineCategory,
              8
            );

            if (Array.isArray(engineResponse.results)) {
              engineResponse.results.forEach(item => {
                const mappedItem = {
                  placeId: item.id,
                  id: item.id,
                  name: item.name,
                  category: item.category,
                  type: item.category,
                  city: item.city,
                  state: item.state,
                  districtName: item.city || item.name,
                  stateName: item.state || "",
                  rating: item.rating,
                  reviewCount: item.reviewCount,
                  description: item.detailedOverview || item.highlight,
                  highlight: item.highlight,
                  detailedOverview: item.detailedOverview,
                  highlightsList: item.highlightsList,
                  timing: item.timing,
                  entryFee: item.entryFee,
                  entryFees: item.entryFees,
                  approxCost: item.approxCost,
                  bestTimeToVisit: item.bestTimeToVisit,
                  bestTimeReason: item.bestTimeReason,
                  season: item.season || "October to March (Winter)",
                  seasonReason: item.seasonReason,
                  images: Array.isArray(item.images) && item.images.length > 0 ? item.images : [item.imageUrl].filter(Boolean),
                  imageUrl: item.imageUrl,
                  imageThumbnail: item.imageThumbnail,
                  fallbackImageUrl: item.fallbackImageUrl || item.imageUrl,
                  tags: item.tags,
                  isDiscovery: true,
                };

                const catLower = (item.category || "").toLowerCase();
                if (
                  catLower.includes("food") ||
                  catLower.includes("cafe") ||
                  catLower.includes("restaurant")
                ) {
                  discoveryFood.push(mappedItem);
                } else {
                  discoveryPlaces.push(mappedItem);
                }
              });
            }
          } catch (engineErr) {
            console.warn("Travel engine lookup warning:", engineErr);
          }
        }

        // Combine static places and discovery places (deduplicated by name)
        const combinedPlaces = [...staticPlaceResults];
        discoveryPlaces.forEach(dp => {
          if (!combinedPlaces.some(p => p.name.toLowerCase() === dp.name.toLowerCase())) {
            combinedPlaces.push(dp);
          }
        });

        setResults({
          users: userResults,
          places: combinedPlaces,
          food: discoveryFood,
          trips: tripResults,
        });

        // Add to history
        setSearchHistory(prev => [
          searchQuery,
          ...prev.filter(h => h !== searchQuery),
        ].slice(0, 6));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(performSearch, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery, user, allPlaces, activeTab]);

  const filteredResults = useMemo(() => {
    if (activeTab === "all") {
      return [
        ...results.places.slice(0, 5),
        ...results.food.slice(0, 5),
        ...results.users.slice(0, 5),
        ...results.trips.slice(0, 5),
      ];
    }
    const typeMap: Record<string, keyof typeof results> = {
      users: "users",
      places: "places",
      food: "food",
      trips: "trips",
    };
    return results[typeMap[activeTab]] || [];
  }, [results, activeTab]);

  const handleResultPress = (item: any, type: "user" | "place" | "trip") => {
    if (type === "user") {
      setSelectedItem(item);
      setDrawerType("user");
      setDrawerVisible(true);
    } else if (type === "place") {
      setSelectedItem(item);
      setDrawerType("place");
      setDrawerVisible(true);
    } else if (type === "trip") {
      router.push(`/trip/${item.id}` as any);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Fixed Search Bar */}
        {searchOpen && (
          <Animated.View entering={FadeIn} style={styles.searchBarContainer}>
            {/* **@** Back Button */}
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home" as any))}
              style={{ padding: 4 }}
              accessibilityLabel="Go Back"
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search-outline" size={20} color="#fff" />
              <TextInput
                style={styles.searchInput}
                placeholder="Find people, trips, or places..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close" size={18} color="#888" />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* **@** Search Button with Back Button (when not open) */}
          {!searchOpen && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home" as any))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                accessibilityLabel="Go Back"
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setSearchOpen(true)}
                style={[styles.searchButton, { flex: 1, marginBottom: 0 }]}
              >
                <Ionicons name="search-outline" size={20} color="#888" />
                <Text style={styles.searchButtonText}>Search Exploration</Text>
              </Pressable>
            </View>
          )}

          {searchOpen ? (
            <>
              {/* Tabs */}
              {searchQuery && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tabsContainer}
                >
                  {["all", "places", "food", "users", "trips"].map(tab => (
                    <Pressable
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      style={[
                        styles.tab,
                        activeTab === tab && styles.tabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          activeTab === tab && styles.tabTextActive,
                        ]}
                      >
                        {tab.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Results or History */}
              {searchQuery ? (
                loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ffffff" />
                  </View>
                ) : filteredResults.length > 0 ? (
                  <View>
                    {(activeTab === "all" || activeTab === "places") && results.places.length > 0 && (
                      <View style={styles.groupContainer}>
                        <Text style={styles.groupTitle}>Places & Sights ({results.places.length})</Text>
                        {results.places.slice(0, activeTab === "all" ? 5 : 50).map((place, i) => (
                          <ResultCard
                            key={place.placeId || place.id}
                            item={place}
                            index={i}
                            onPress={() => handleResultPress(place, "place")}
                            icon="map-marker"
                          />
                        ))}
                      </View>
                    )}

                    {(activeTab === "all" || activeTab === "food") && results.food.length > 0 && (
                      <View style={styles.groupContainer}>
                        <Text style={styles.groupTitle}>Food, Cafes & Drinks ({results.food.length})</Text>
                        {results.food.slice(0, activeTab === "all" ? 5 : 50).map((foodItem, i) => (
                          <ResultCard
                            key={foodItem.placeId || foodItem.id}
                            item={foodItem}
                            index={i}
                            onPress={() => handleResultPress(foodItem, "place")}
                            icon="silverware-fork-knife"
                          />
                        ))}
                      </View>
                    )}

                    {(activeTab === "all" || activeTab === "users") && results.users.length > 0 && (
                      <View style={styles.groupContainer}>
                        <Text style={styles.groupTitle}>Users ({results.users.length})</Text>
                        {results.users.slice(0, activeTab === "all" ? 5 : 50).map((user, i) => (
                          <ResultCard
                            key={user.id}
                            item={user}
                            index={i}
                            onPress={() => handleResultPress(user, "user")}
                            icon="account"
                          />
                        ))}
                      </View>
                    )}

                    {(activeTab === "all" || activeTab === "trips") && results.trips.length > 0 && (
                      <View style={styles.groupContainer}>
                        <Text style={styles.groupTitle}>Trips ({results.trips.length})</Text>
                        {results.trips.map((trip, i) => (
                          <ResultCard
                            key={trip.id}
                            item={trip}
                            index={i}
                            onPress={() => handleResultPress(trip, "trip")}
                            icon="map-marker"
                          />
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.emptyText}>No results found</Text>
                    <Text style={styles.emptySubtext}>
                      {activeTab === "places"
                        ? "No places found for this search"
                        : activeTab === "food"
                        ? "No food found for this search"
                        : "Try a different search"}
                    </Text>
                  </View>
                )
              ) : searchHistory.length > 0 ? (
                <View style={styles.historyContainer}>
                  <Text style={styles.historyTitle}>Recent Searches</Text>
                  {searchHistory.slice(0, 5).map((item, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setSearchQuery(item)}
                      style={styles.historyItem}
                    >
                      <Ionicons name="time-outline" size={16} color="#888" />
                      <Text style={styles.historyItemText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.emptyText}>Start searching</Text>
                  <Text style={styles.emptySubtext}>Find users, trips, and places</Text>
                </View>
              )}
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Drawer Modal */}
        <Modal
          visible={drawerVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setDrawerVisible(false)}
        >
          <View style={styles.drawerOverlay}>
            <Pressable
              style={styles.drawerBackdrop}
              onPress={() => setDrawerVisible(false)}
            />
            <MotiView
              from={{ translateY: 400, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              transition={{ type: "timing", duration: 280 }}
              style={styles.drawerContent}
            >
              <View style={styles.drawerHandle} />

              {drawerType === "user" && selectedItem && (
                <UserDrawerContent
                  user={selectedItem}
                  onClose={() => setDrawerVisible(false)}
                />
              )}

              {drawerType === "place" && selectedItem && (
                <PlaceDrawerContent
                  place={selectedItem}
                  onClose={() => setDrawerVisible(false)}
                />
              )}
            </MotiView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}


// Result Card Component
function ResultCard({
  item,
  index,
  onPress,
  icon,
}: {
  item: any;
  index: number;
  onPress: () => void;
  icon: string;
}) {
  const fallbackUrl = item.fallbackImageUrl || getFallbackPhoto(item.category || item.type || "", item.name || "");
  const initialUri = item.imageUrl || item.imageThumbnail || item.images?.[0] || fallbackUrl;
  const [imageUri, setImageUri] = useState<string>(initialUri);

  useEffect(() => {
    setImageUri(item.imageUrl || item.imageThumbnail || item.images?.[0] || fallbackUrl);
  }, [item]);

  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: index * 30 }}
    >
      <Pressable onPress={onPress} style={styles.resultCard}>
        {imageUri ? (
          <ExpoImage
            source={{
              uri: imageUri,
              headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
                "Referer": "https://en.wikipedia.org/",
              },
            }}
            style={styles.resultImageThumbnail}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            onError={() => {
              if (imageUri !== fallbackUrl) {
                setImageUri(fallbackUrl);
              }
            }}
          />
        ) : (
          <View style={styles.resultIconContainer}>
            <MaterialCommunityIcons name={icon as any} size={20} color="#00f721" />
          </View>
        )}

        <View style={styles.resultTextContainer}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {item.displayName || item.name || item.title}
            </Text>
            {item.rating ? (
              <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
                ⭐ {item.rating}
              </Text>
            ) : null}
          </View>
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {item.category ? `${item.category} • ` : ""}
            {item.username ? `@${item.username}` : item.districtName || item.city || item.description || ""}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#666" />
      </Pressable>
    </MotiView>
  );
}

// User Drawer Content
function UserDrawerContent({ user, onClose }: { user: any; onClose: () => void }) {
  const router = useRouter();

  return (
    <ScrollView style={styles.drawerScrollView} showsVerticalScrollIndicator={false}>
      <View style={styles.userHeader}>
        <ExpoImage
          source={{ uri: user.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80" }}
          style={styles.userAvatar}
          contentFit="cover"
        />
        <Text style={styles.userName}>{user.displayName || user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>

        <View style={styles.userChips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Public</Text>
          </View>
        </View>
      </View>

      <View style={styles.userDetails}>
        <Text style={styles.detailLabel}>Username</Text>
        <Text style={styles.detailValue}>@{user.username || "username"}</Text>

        <Text style={styles.detailLabel}>Email</Text>
        <Text style={styles.detailValue}>{user.email}</Text>

        {user.location && (
          <>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>{user.location}</Text>
          </>
        )}

        {user.occupation && (
          <>
            <Text style={styles.detailLabel}>Occupation</Text>
            <Text style={styles.detailValue}>{user.occupation}</Text>
          </>
        )}
      </View>

      <View style={styles.userActions}>
        <Pressable style={styles.actionButton} onPress={() => router.push(`/profile/${user.uid}` as any)}>
          <Text style={styles.actionButtonText}>View Profile</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// Place Drawer Content
function PlaceDrawerContent({ place, onClose }: { place: any; onClose: () => void }) {
  const router = useRouter();
  const fallbackUrl = place.fallbackImageUrl || getFallbackPhoto(place.category || place.type || "", place.name || "");
  const initialUri = place.imageUrl || place.imageThumbnail || place.images?.[0] || fallbackUrl;
  const [currentImage, setCurrentImage] = useState<string>(initialUri);

  useEffect(() => {
    setCurrentImage(place.imageUrl || place.imageThumbnail || place.images?.[0] || fallbackUrl);
  }, [place]);

  return (
    <ScrollView style={styles.drawerScrollView} showsVerticalScrollIndicator={false}>
      {currentImage ? (
        <ExpoImage
          source={{
            uri: currentImage,
            headers: {
              "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
              "Referer": "https://en.wikipedia.org/",
            },
          }}
          style={styles.placeImage}
          contentFit="cover"
          transition={250}
          cachePolicy="disk"
          onError={() => {
            if (currentImage !== fallbackUrl) {
              setCurrentImage(fallbackUrl);
            }
          }}
        />
      ) : null}

      <View style={styles.placeInfo}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.placeName, { flex: 1 }]}>{place.name}</Text>
          {place.rating ? (
            <View style={[styles.chip, { backgroundColor: "rgba(255, 215, 0, 0.15)", borderWidth: 1, borderColor: "rgba(255, 215, 0, 0.3)" }]}>
              <Text style={[styles.chipText, { color: "#FFD700", fontWeight: "700" }]}>⭐ {place.rating}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.placeLocation}>
          {place.districtName || place.city}{place.stateName || place.state ? `, ${place.stateName || place.state}` : ""}
        </Text>

        <View style={styles.placeChips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{place.category || place.type || "Sightseeing"}</Text>
          </View>
          {place.districtName || place.city ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{place.districtName || place.city}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.placeDescription}>{place.highlight || place.description}</Text>

        <View style={styles.placeDetails}>
          <View style={styles.detailBox}>
            <MaterialCommunityIcons name="clock-outline" size={18} color="#ffffff" />
            <Text style={styles.detailBoxLabel}>Timing</Text>
            <Text style={styles.detailBoxValue}>{place.timing || "Open daily"}</Text>
          </View>

          <View style={styles.detailBox}>
            <Ionicons name="pricetag-outline" size={18} color="#ffffff" />
            <Text style={styles.detailBoxLabel}>Cost / Entry</Text>
            <Text style={styles.detailBoxValue}>{place.entryFee || place.approxCost || "Free"}</Text>
          </View>
        </View>

        {place.bestTimeToVisit ? (
          <View style={[styles.detailBox, { marginTop: 8 }]}>
            <MaterialCommunityIcons name="calendar-month" size={18} color="#ffffff" />
            <Text style={styles.detailBoxLabel}>Best Time to Visit</Text>
            <Text style={styles.detailBoxValue}>{place.bestTimeToVisit}</Text>
          </View>
        ) : null}

        <View style={styles.placeActions}>
          <Pressable style={[styles.actionButton, { flex: 1 }]} onPress={onClose}>
            <Text style={styles.actionButtonText}>Close</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.primaryButton, { flex: 1, marginLeft: 10 }]}
            onPress={() => {
              onClose();
              const allImages = Array.isArray(place.images) && place.images.length > 0
                ? place.images
                : [currentImage, fallbackUrl].filter(Boolean);
              router.push({
                pathname: "/place-details",
                params: {
                  placeId: place.placeId || place.id,
                  placeData: JSON.stringify({
                    ...place,
                    imageUrl: currentImage,
                    images: allImages,
                  }),
                },
              });
            }}
          >
            <Text style={[styles.actionButtonText, { color: "#000" }]}>View Details</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12 },

  // Search Bar
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    marginHorizontal: 8,
  },
  closeButton: { paddingHorizontal: 8 },
  closeButtonText: { color: "#888", fontSize: 14, fontWeight: "600" },

  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  searchButtonText: { color: "#888", fontSize: 14, marginLeft: 12 },

  // Tabs
  tabsContainer: { marginBottom: 16, paddingRight: 16 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  tabText: { fontSize: 12, fontWeight: "600", color: "#888" },
  tabTextActive: { color: "#ffffff", fontWeight: "700" },

  // Results
  groupContainer: { marginBottom: 20 },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#aaa",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  resultIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  resultImageThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  resultTextContainer: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: "600", color: "#fff", marginBottom: 2 },
  resultSubtitle: { fontSize: 12, color: "#888" },

  // Empty State
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#fff", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#888", marginTop: 6 },

  // History
  historyContainer: { marginTop: 16 },
  historyTitle: { fontSize: 13, fontWeight: "600", color: "#aaa", marginBottom: 8, textTransform: "uppercase" },
  historyItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  historyItemText: { fontSize: 14, color: "#fff" },

  // Loading
  loadingContainer: { justifyContent: "center", alignItems: "center", paddingVertical: 60 },

  // Drawer
  drawerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  drawerBackdrop: { flex: 1 },
  drawerContent: {
    backgroundColor: "#0c0c0c",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "90%",
  },
  drawerHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 8,
    marginBottom: 16,
  },
  drawerScrollView: { padding: 16 },

  // User Drawer
  userHeader: { alignItems: "center", marginBottom: 24 },
  userAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 12 },
  userName: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  userEmail: { fontSize: 12, color: "#aaa", marginBottom: 12 },
  userChips: { flexDirection: "row", gap: 8 },
  chip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  chipText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },

  userDetails: { marginBottom: 20 },
  detailLabel: { fontSize: 12, fontWeight: "600", color: "#aaa", marginTop: 12, marginBottom: 4 },
  detailValue: { fontSize: 13, color: "#fff" },

  userActions: { marginTop: 20, marginBottom: 20 },
  actionButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  primaryButton: { backgroundColor: "#fff" },
  actionButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Place Drawer
  placeImage: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16 },
  placeInfo: { marginBottom: 20 },
  placeName: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  placeLocation: { fontSize: 12, color: "#aaa", marginBottom: 12 },
  placeChips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  placeDescription: { fontSize: 13, color: "#ccc", lineHeight: 20, marginBottom: 16 },

  placeDetails: { flexDirection: "row", gap: 12, marginBottom: 16 },
  detailBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  detailBoxLabel: { fontSize: 11, color: "#aaa", marginTop: 6 },
  detailBoxValue: { fontSize: 12, fontWeight: "bold", color: "#fff", marginTop: 2 },

  placeActions: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 20 },
});
