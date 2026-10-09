import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  Text,
  StatusBar,
  ImageBackground,
  FlatList,
  useWindowDimensions,
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

import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import NotificationBell from "../../components/NotificationBell";

import * as Location from "expo-location";

import {
  fetchCurrentWeather,
  fetchAirPollution,
  parseRefreshIntervalMs,
} from "../../lib/WeatherService";
import WeatherDetailsSheet from "./Weather/WeatherDetailsSheet";
import AQIDetailsSheet from "./Weather/AQIDetailsSheet";

import placesData from "../data/data.json";
import { useAppSettings } from "../../contexts/AppSettingsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeToggle } from "../../contexts/ThemeContext";
import { SkeletonLoadingScreen } from "../../components/ui/SkeletonLoadingScreen";


// ============================================================
// PLACE DATA
// ============================================================

const generateAllPlaces = () =>
  placesData.states.flatMap((state) =>
    state.districts.flatMap((district) =>
      district.places.map((place) => ({
        ...place,
        districtName: district.name,
        stateName: state.name,
        placeId: `${place.name.replace(/\s+/g, "_")}_${state.name}_${district.name}`,
      }))
    )
  );


// ============================================================
// HOME
// ============================================================

export default function Home() {
  const router = useRouter();

  const { width, height } = useWindowDimensions();

  const {
    user,
    loading: authLoading,
    userData,
  } = useUser();

  const {
    formatTemperature,
    formatWindSpeed,
    widgetLayout,
    showFeelsLike,
    showWindSpeed,
    severeAlerts,
    rainNotifications,
    highPollutionAlerts,
    refreshInterval,
  } = useAppSettings();
  const { t } = useLanguage();

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return t("good_morning", "Good Morning,");
    if (hr < 17) return t("good_afternoon", "Good Afternoon,");
    if (hr < 21) return t("good_evening", "Good Evening,");
    return t("good_night", "Good Night,");
  };


  // ==========================================================
  // RESPONSIVE SIZING
  // ==========================================================

  /*
   * Base design is optimized around a normal 390px phone.
   *
   * Scaling is intentionally limited.
   * This prevents the UI from becoming huge on larger phones.
   */

  const scale = Math.min(
    Math.max(width / 390, 0.94),
    1.02
  );

  const horizontalPadding = Math.min(
    Math.max(width * 0.045, 18),
    22
  );

  const tripCardWidth =
    width - horizontalPadding * 2;

  const tripCardHeight = Math.min(
    Math.max(width * 0.42, 165),
    190
  );

  const reminderWidth = Math.min(
    Math.max(width * 0.72, 270),
    320
  );

  const placeCardWidth =
    width - horizontalPadding * 2;

  const placeImageHeight = Math.min(
    Math.max(placeCardWidth * 0.58, 190),
    260
  );


  // ==========================================================
  // STATES
  // ==========================================================

  const { isDark, themeColors, accentColor, background, scaleFont } = useThemeToggle();
  const [loading, setLoading] = useState(true);

  const [weather, setWeather] =
    useState<any>(null);

  const [aqiValue, setAqiValue] =
    useState<number | null>(null);

  const [aqiData, setAqiData] =
    useState<any>(null);

  const [airPollution, setAirPollution] =
    useState<any>(null);

  const [showAqiDetails, setShowAqiDetails] =
    useState(false);

  const [locationAvailable, setLocationAvailable] =
    useState(false);

  const [trips, setTrips] =
    useState<any[]>([]);

  const [reminders, setReminders] =
    useState<any[]>([]);

  const [likesData, setLikesData] =
    useState<any>({});

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [showWeatherDetails, setShowWeatherDetails] =
    useState(false);

  const [activeTripIndex, setActiveTripIndex] =
    useState(0);


  // ==========================================================
  // PLACES
  // ==========================================================

  const allPlaces = useMemo(
    () => generateAllPlaces(),
    []
  );


  // ==========================================================
  // AUTH
  // ==========================================================

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login" as any);
      return;
    }

    setLoading(false);
  }, [user, authLoading]);


  // ==========================================================
  // FIRESTORE TRIPS + REMINDERS
  // ==========================================================

  useEffect(() => {
    if (!user) return;

    const tripsQuery = query(
      collection(db, "trips"),
      where("members", "array-contains", user.uid)
    );

    const unsubTrips = onSnapshot(
      tripsQuery,
      (snapshot) => {
        const tripList = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as any[];

        tripList.sort((a, b) => {
          const dateA = new Date(
            a.startDate || 0
          ).getTime();

          const dateB = new Date(
            b.startDate || 0
          ).getTime();

          return dateB - dateA;
        });


        // ------------------------------------------------------
        // Get group chat image
        // ------------------------------------------------------

        (async () => {
          try {
            const enriched =
              await Promise.all(
                tripList.map(async (trip) => {
                  try {
                    const groupQuery =
                      query(
                        collection(
                          db,
                          "groupChats"
                        ),
                        where(
                          "tripId",
                          "==",
                          trip.id
                        )
                      );

                    const groupSnapshot =
                      await getDocs(
                        groupQuery
                      );

                    if (
                      !groupSnapshot.empty
                    ) {
                      const group =
                        groupSnapshot.docs[0].data();

                      return {
                        ...trip,
                        iconURL:
                          group.iconURL ||
                          trip.iconURL,
                      };
                    }
                  } catch (error) {
                    console.error(
                      "groupChat lookup failed:",
                      error
                    );
                  }

                  return trip;
                })
              );

            setTrips(enriched);
          } catch (error) {
            console.error(
              "Trip enrichment error:",
              error
            );

            setTrips(tripList);
          }
        })();
      }
    );


    // ----------------------------------------------------------
    // REMINDERS
    // ----------------------------------------------------------

    const remindersQuery = query(
      collection(db, "reminders"),
      where("uid", "==", user.uid)
    );

    const unsubReminders = onSnapshot(
      remindersQuery,
      (snapshot) => {
        const reminderList =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as any[];

        reminderList.sort((a, b) => {
          const dateA = new Date(
            a.date || 0
          ).getTime();

          const dateB = new Date(
            b.date || 0
          ).getTime();

          return dateA - dateB;
        });

        setReminders(reminderList);
      }
    );


    return () => {
      unsubTrips();
      unsubReminders();
    };
  }, [user]);


  // ==========================================================
  // PLACE LIKES
  // ==========================================================

  useEffect(() => {
    if (!user || !allPlaces.length) return;

    const unsubscribes: any[] = [];

    allPlaces.forEach((place) => {
      const placeRef = doc(
        db,
        "places",
        place.placeId
      );

      const unsubscribe = onSnapshot(
        placeRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setLikesData((previous: any) => ({
              ...previous,
              [place.placeId]:
                snapshot.data(),
            }));
          } else {
            setLikesData((previous: any) => ({
              ...previous,
              [place.placeId]: {
                likesCount: 0,
                likedBy: [],
              },
            }));
          }
        }
      );

      unsubscribes.push(unsubscribe);
    });

    return () =>
      unsubscribes.forEach(
        (unsubscribe) =>
          unsubscribe()
      );
  }, [user, allPlaces]);


  // ==========================================================
  // LIKE HANDLER
  // ==========================================================

  const handleLike = async (
    place: any
  ) => {
    if (!user) return;

    try {
      const placeRef = doc(
        db,
        "places",
        place.placeId
      );

      const snapshot =
        await getDoc(placeRef);

      if (!snapshot.exists()) {
        await setDoc(placeRef, {
          likesCount: 1,
          likedBy: [user.uid],
          updatedAt: new Date(),
        });

        return;
      }

      const data = snapshot.data();

      const alreadyLiked =
        data.likedBy?.includes(
          user.uid
        );

      if (alreadyLiked) {
        await updateDoc(
          placeRef,
          {
            likesCount:
              increment(-1),
            likedBy:
              arrayRemove(user.uid),
          }
        );
      } else {
        await updateDoc(
          placeRef,
          {
            likesCount:
              increment(1),
            likedBy:
              arrayUnion(user.uid),
          }
        );
      }
    } catch (error) {
      console.error(
        "Like error:",
        error
      );
    }
  };


  // ==========================================================
  // LOCATION + WEATHER + AQI
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadLocationAndWeather =
      async () => {
        try {
          const permission =
            await Location.requestForegroundPermissionsAsync();

          if (
            permission.status !==
            "granted"
          ) {
            if (mounted) {
              setLocationAvailable(
                false
              );
              setWeather(null);
            }

            return;
          }

          const location =
            await Location.getCurrentPositionAsync(
              {
                accuracy:
                  Location.Accuracy.Balanced,
              }
            );

          if (!mounted) return;

          setLocationAvailable(true);

          const cacheAge = parseRefreshIntervalMs(refreshInterval);

          // ----------------------------------------------------
          // WEATHER
          // ----------------------------------------------------

          let weatherResult: any = null;
          try {
            const weatherData =
              await fetchCurrentWeather(
                location.coords.latitude,
                location.coords.longitude,
                cacheAge
              );

            weatherResult = weatherData;
            if (mounted) {
              setWeather(
                weatherData || null
              );
            }
          } catch (error) {
            console.log(
              "Weather fetch error:",
              error
            );

            if (mounted) {
              setWeather(null);
            }
          }


          // ----------------------------------------------------
          // AQI & AIR POLLUTION
          // ----------------------------------------------------

          try {
            const pollution = await fetchAirPollution(
              location.coords.latitude,
              location.coords.longitude,
              cacheAge
            );

            if (mounted && pollution) {
              setAirPollution(pollution);
              setAqiValue(pollution.value);
              setAqiData({
                station: `${weatherResult?.name || "Local"} Environmental Station`,
                city: weatherResult?.name || "Local Area",
                state: weatherResult?.sys?.country || "",
                value: pollution.value,
                status: pollution.status,
                color: pollution.color,
                pollutants: pollution.pollutants,
              });
            }
          } catch (error) {
            console.log(
              "Air pollution fetch error:",
              error
            );

            // Fallback to secondary source if openweather fails
            try {
              const response =
                await fetch(
                  "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=579b464db66ec23bdd0000011c04ccafb50742ba6a0a7d5e22aa498e&format=json&limit=1"
                );
              const json = await response.json();
              if (mounted && json.records?.length) {
                const rec = json.records[0];
                setAqiData(rec);
                const value = parseInt(rec.avg_value);
                if (!Number.isNaN(value)) {
                  setAqiValue(value);
                }
              }
            } catch {}
          }
        } catch (error) {
          console.log(
            "Location error:",
            error
          );

          if (mounted) {
            setLocationAvailable(
              false
            );
            setWeather(null);
          }
        }
      };

    loadLocationAndWeather();

    return () => {
      mounted = false;
    };
  }, []);


  // ==========================================================
  // TRIP PAGINATION
  // ==========================================================

  const handleTripScroll = (
    event: any
  ) => {
    const offsetX =
      event.nativeEvent.contentOffset.x;

    const pageWidth =
      event.nativeEvent.layoutMeasurement
        .width;

    if (!pageWidth) return;

    const slide = Math.round(
      offsetX / pageWidth
    );

    if (
      slide !== activeTripIndex
    ) {
      setActiveTripIndex(slide);
    }
  };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (authLoading || loading) {
    return <SkeletonLoadingScreen title="BunkMates" showAvatarCard={true} itemCount={3} />;
  }


  // ==========================================================
  // DISPLAY VALUES
  // ==========================================================

  const userName =
    userData?.name ||
    user?.displayName ||
    "Mohit Sharma";

  const weatherTemperature =
    weather?.main?.temp != null
      ? formatTemperature(weather.main.temp, "C")
      : "--";

  const weatherDescription =
    weather?.weather?.[0]
      ?.description ||
    "";

  const weatherLocation =
    locationAvailable &&
    weather?.name
      ? weather.name
      : "Location currently unavailable";

  const weatherIcon =
    weather?.weather?.[0]?.icon;

  const getWeatherIcon =
    () => {
      if (
        weatherIcon?.startsWith(
          "09"
        ) ||
        weatherIcon?.startsWith(
          "10"
        )
      ) {
        return "weather-rainy";
      }

      if (
        weatherIcon?.startsWith(
          "11"
        )
      ) {
        return "weather-lightning";
      }

      if (
        weatherIcon?.startsWith(
          "13"
        )
      ) {
        return "weather-snowy";
      }

      if (
        weatherIcon?.startsWith(
          "50"
        )
      ) {
        return "weather-fog";
      }

      if (
        weatherIcon?.startsWith(
          "01"
        )
      ) {
        return "weather-sunny";
      }

      if (
        weatherIcon?.startsWith(
          "02"
        ) ||
        weatherIcon?.startsWith(
          "03"
        ) ||
        weatherIcon?.startsWith(
          "04"
        )
      ) {
        return "weather-partly-cloudy";
      }

      return "weather-cloudy";
    };

  const weatherMain = weather?.weather?.[0]?.main || "";
  const isSevereWeather =
    severeAlerts &&
    (weatherMain === "Thunderstorm" ||
      weatherMain === "Squall" ||
      weatherMain === "Tornado" ||
      Boolean(weather?.wind?.speed && weather.wind.speed > 15));

  const isRainActive =
    rainNotifications &&
    (weatherMain === "Rain" || weatherMain === "Drizzle");

  const isHighPollution =
    highPollutionAlerts && aqiValue != null && aqiValue > 100;


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            background.mode === "solid"
              ? themeColors.background
              : "transparent",
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.background}
      />

      <View
        style={[
          styles.container,
          {
            backgroundColor:
              background.mode === "solid"
                ? themeColors.background
                : "transparent",
          },
        ]}
      >

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                130 * scale,
            },
          ]}
        >

          {/* ==================================================
              HEADER
          ================================================== */}

          <View
            style={[
              styles.header,
              {
                paddingHorizontal:
                  horizontalPadding,
              },
            ]}
          >
            <View>
              <Text
                style={[
                  styles.greeting,
                  {
                    fontSize:
                      scaleFont(15 * scale),
                    color: themeColors.textSecondary,
                  },
                ]}
              >
                {getGreeting()}
              </Text>

              <Text
                style={[
                  styles.name,
                  {
                    fontSize:
                      scaleFont(24 * scale),
                    color: themeColors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {userName}
              </Text>
            </View>

            <NotificationBell />
          </View>


          {/* ==================================================
              WEATHER + AQI
          ================================================== */}

          <View
            style={{
              paddingHorizontal: horizontalPadding,
              marginTop: 58 * scale,
            }}
          >
            {/* Live Weather Alerts Banner if active */}
            {isSevereWeather && (
              <View style={styles.homeAlertBannerSevere}>
                <Feather name="alert-triangle" size={13} color="#ff4757" />
                <Text style={styles.homeAlertBannerText}>
                  Severe Weather Advisory: {weatherMain || "Storm"} detected
                </Text>
              </View>
            )}
            {isRainActive && !isSevereWeather && (
              <View style={styles.homeAlertBannerRain}>
                <Feather name="cloud-rain" size={13} color="#38bdf8" />
                <Text style={styles.homeAlertBannerRainText}>
                  Precipitation Notice: Active rainfall in your area
                </Text>
              </View>
            )}

            {widgetLayout === "Compact Tile" ? (
              /* Compact Tile layout */
              <Pressable
                style={[
                  styles.compactTileContainer,
                  isHighPollution && styles.compactTilePollutionBorder,
                ]}
                onPress={() => {
                  if (weather) setShowWeatherDetails(true);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
                  <MaterialCommunityIcons
                    name={getWeatherIcon() as any}
                    size={32 * scale}
                    color="#ffffff"
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.compactTempText, { fontSize: 19 * scale }]}>
                        {weatherTemperature}
                      </Text>
                      {locationAvailable && weather?.name ? (
                        <Text style={[styles.compactCityText, { fontSize: 13 * scale }]} numberOfLines={1}>
                          • {weatherLocation}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <Text style={[styles.compactDescText, { fontSize: 11.5 * scale }]} numberOfLines={1}>
                        {weatherDescription || "Clear"}
                      </Text>
                      {showFeelsLike && weather?.main?.feels_like != null ? (
                        <Text style={[styles.compactMetaText, { fontSize: 11 * scale }]}>
                          Feels {formatTemperature(weather.main.feels_like, "C")}
                        </Text>
                      ) : null}
                      {showWindSpeed && weather?.wind?.speed != null ? (
                        <Text style={[styles.compactMetaText, { fontSize: 11 * scale }]}>
                          💨 {formatWindSpeed(weather.wind.speed)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Compact AQI badge */}
                <Pressable
                  style={[
                    styles.compactAqiPill,
                    {
                      backgroundColor: aqiData?.color ? `${aqiData.color}22` : "rgba(255,255,255,0.08)",
                      borderColor: aqiData?.color || "rgba(255,255,255,0.2)",
                    },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowAqiDetails(true);
                  }}
                >
                  <Text style={[styles.compactAqiNum, { color: aqiData?.color || "#fff" }]}>
                    {aqiValue ?? "—"}
                  </Text>
                  <Text style={[styles.compactAqiStatus, { color: aqiData?.color || "#999" }]}>
                    {aqiValue == null ? "AQI" : aqiData?.status || (aqiValue <= 50 ? "Good" : aqiValue <= 100 ? "Mod" : "Poor")}
                  </Text>
                </Pressable>
              </Pressable>
            ) : (
              /* Detailed Card layout (default) */
              <View style={styles.weatherAqiRow}>
                <Pressable
                  style={styles.weatherInfo}
                  onPress={() => {
                    if (weather) setShowWeatherDetails(true);
                  }}
                >
                  <MaterialCommunityIcons
                    name={getWeatherIcon() as any}
                    size={40 * scale}
                    color="#ffffff"
                  />

                  <View style={{ marginLeft: 12 * scale, flexShrink: 1 }}>
                    <Text
                      style={[styles.tempText, { fontSize: 20 * scale }]}
                      numberOfLines={1}
                    >
                      {weatherTemperature}
                      {"  "}
                      {locationAvailable && weather?.name ? "•" : ""}
                      {"  "}
                      {weatherLocation}
                    </Text>

                    {weatherDescription ? (
                      <Text
                        style={[styles.subText, { fontSize: 13 * scale }]}
                        numberOfLines={1}
                      >
                        {weatherDescription}
                      </Text>
                    ) : null}

                    {(showFeelsLike || showWindSpeed) ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {showFeelsLike && weather?.main?.feels_like != null ? (
                          <Text style={styles.metricSubText}>
                            Feels {formatTemperature(weather.main.feels_like, "C")}
                          </Text>
                        ) : null}
                        {showWindSpeed && weather?.wind?.speed != null ? (
                          <Text style={styles.metricSubText}>
                            💨 {formatWindSpeed(weather.wind.speed)}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Pressable>

                {/* AQI Badge */}
                <Pressable
                  style={[
                    styles.aqiBadge,
                    {
                      width: Math.min(132 * scale, 145),
                      height: Math.min(132 * scale, 145),
                    },
                    isHighPollution && {
                      borderColor: "#f97316",
                      borderWidth: 1.5,
                      backgroundColor: "rgba(249, 115, 22, 0.12)",
                    },
                  ]}
                  onPress={() => setShowAqiDetails(true)}
                >
                  <Feather
                    name={isHighPollution ? "alert-triangle" : "info"}
                    size={14 * scale}
                    color={isHighPollution ? "#f97316" : "#999"}
                    style={styles.infoIcon}
                  />

                  <Text
                    style={[
                      styles.aqiNumber,
                      { fontSize: 40 * scale },
                      aqiData?.color ? { color: aqiData.color } : null,
                    ]}
                  >
                    {aqiValue ?? "—"}
                  </Text>

                  <Text
                    style={[
                      styles.aqiLabel,
                      { fontSize: 11 * scale },
                      aqiData?.color ? { color: aqiData.color } : null,
                    ]}
                  >
                    AQI •{" "}
                    {aqiValue == null
                      ? "Unavailable"
                      : aqiData?.status ||
                        (aqiValue <= 50
                          ? "Good"
                          : aqiValue <= 100
                          ? "Moderate"
                          : "Poor")}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>


          {/* ==================================================
              SEARCH
          ================================================== */}

          <Pressable
            style={[
              styles.searchBar,
              {
                marginHorizontal:
                  horizontalPadding,
                marginTop:
                  28 * scale,
                height:
                  48 * scale,
              },
            ]}
            onPress={() =>
              router.push(
                "/search" as any
              )
            }
          >
            <Ionicons
              name="search-outline"
              size={
                20 * scale
              }
              color="#ffffff"
            />

            <Text
              style={[
                styles.searchText,
                {
                  fontSize:
                    13 * scale,
                },
              ]}
            >
              {t("search_exploration", "Search Exploration")}
            </Text>
          </Pressable>


          {/* ==================================================
              YOUR TRIPS
          ================================================== */}

          <View
            style={[
              styles.sectionHeader,
              {
                paddingHorizontal:
                  horizontalPadding,
                marginTop: 55,
                marginBottom:
                  15 * scale,
              },
            ]}
          >

            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize:
                    22 * scale,
                },
              ]}
            >
              {t("your_trips", "Your Trips")}
            </Text>

            <Pressable
              onPress={() =>
                router.push(
                  "/(tabs)/trips" as any
                )
              }
            >
              <Text
                style={[
                  styles.viewAll,
                  {
                    fontSize:
                      13 * scale,
                  },
                ]}
              >
                {t("view_all", "View all")}
              </Text>
            </Pressable>

          </View>


          {trips.length > 0 ? (
            <View>

              <FlatList
                data={trips}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={
                  false
                }
                onScroll={
                  handleTripScroll
                }
                scrollEventThrottle={
                  16
                }
                keyExtractor={(item) =>
                  item.id
                }
                getItemLayout={(
                  _data,
                  index
                ) => ({
                  length:
                    tripCardWidth,
                  offset:
                    tripCardWidth *
                    index,
                  index,
                })}
                renderItem={({
                  item,
                }) => (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname:
                          "/(tabs)/trips" as any,
                        params: {
                          tripId:
                            item.id,
                        },
                      })
                    }
                    style={[
                      styles.tripCardContainer,
                      {
                        width:
                          tripCardWidth,
                        paddingHorizontal:
                          0,
                      },
                    ]}
                  >

                    <ImageBackground
                      source={{
                        uri:
                          item.iconURL ||
                          "https://images.unsplash.com/photo-1506461883276-594a12b11cf3",
                      }}
                      style={[
                        styles.tripCard,
                        {
                          height:
                            tripCardHeight,
                          borderRadius:
                            22 * scale,
                        },
                      ]}
                      imageStyle={{
                        borderRadius:
                          22 * scale,
                      }}
                    >

                      <LinearGradient
                        colors={[
                          "transparent",
                          "rgba(0,0,0,0.88)",
                        ]}
                        style={
                          styles.tripGradient
                        }
                      >

                        <View
                          style={[
                            styles.tripContent,
                            {
                              padding:
                                16 *
                                scale,
                            },
                          ]}
                        >

                          <View
                            style={
                              styles.tripMainRow
                            }
                          >

                            <Text
                              style={[
                                styles.tripTitle,
                                {
                                  fontSize:
                                    20 *
                                    scale,
                                },
                              ]}
                              numberOfLines={
                                1
                              }
                            >
                              {item.name ||
                                "Trip"}
                            </Text>

                            <View
                              style={
                                styles.avatarGroup
                              }
                            >

                              <Image
                                source={{
                                  uri:
                                    userData?.photoURL ||
                                    user?.photoURL ||
                                    "https://i.pravatar.cc/150?img=11",
                                }}
                                style={[
                                  styles.miniAvatar,
                                  {
                                    width:
                                      36 *
                                      scale,
                                    height:
                                      36 *
                                      scale,
                                    borderRadius:
                                      18 *
                                      scale,
                                  },
                                ]}
                              />

                            </View>

                          </View>


                          <Text
                            style={[
                              styles.tripSub,
                              {
                                fontSize:
                                  13 *
                                  scale,
                              },
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            <Ionicons
                              name="location-sharp"
                              size={
                                15 *
                                scale
                              }
                            />{" "}
                            {item.from ||
                              "—"}{" "}
                            →{" "}
                            {item.location ||
                              "—"}
                          </Text>


                          <Text
                            style={[
                              styles.tripSub,
                              {
                                fontSize:
                                  13 *
                                  scale,
                              },
                            ]}
                            numberOfLines={
                              1
                            }
                          >
                            <Ionicons
                              name="time-outline"
                              size={
                                15 *
                                scale
                              }
                            />{" "}
                            {item.startDate ||
                              "—"}{" "}
                            →{" "}
                            {item.endDate ||
                              "?"}
                          </Text>

                        </View>

                      </LinearGradient>

                    </ImageBackground>

                  </Pressable>
                )}
              />


              {/* Trip dots */}

              <View
                style={[
                  styles.paginationDots,
                  {
                    marginTop:
                      12 * scale,
                  },
                ]}
              >
                {trips.map(
                  (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        {
                          width:
                            activeTripIndex ===
                            index
                              ? 58 *
                                scale
                              : 12 *
                                scale,
                          height:
                            6 *
                            scale,
                          backgroundColor:
                            activeTripIndex ===
                            index
                              ? "#ffffff"
                              : "rgba(255,255,255,0.25)",
                        },
                      ]}
                    />
                  )
                )}
              </View>

            </View>
          ) : (
            <View
              style={[
                styles.emptyTrip,
                {
                  marginHorizontal:
                    horizontalPadding,
                },
              ]}
            >
              <Ionicons
                name="airplane-outline"
                size={
                  28 * scale
                }
                color="#666"
              />

              <Text
                style={[
                  styles.emptyText,
                  {
                    fontSize:
                      13 * scale,
                  },
                ]}
              >
                {t("No trips yet")}
              </Text>
            </View>
          )}


          {/* ==================================================
              REMINDERS
          ================================================== */}

          <View
            style={[
              styles.sectionHeader,
              {
                paddingHorizontal:
                  horizontalPadding,
                marginTop: 48,
                marginBottom:
                  15 * scale,
              },
            ]}
          >

            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize:
                    22 * scale,
                },
              ]}
            >
              {t("reminders", "Reminders")}
            </Text>

            <Pressable
              onPress={() =>
                router.push(
                  "/(tabs)/reminders" as any
                )
              }
            >
              <Text
                style={[
                  styles.viewAll,
                  {
                    fontSize:
                      13 * scale,
                  },
                ]}
              >
                {t("view_all", "View all")}
              </Text>
            </Pressable>

          </View>


          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={{
              paddingLeft:
                horizontalPadding,
              paddingRight:
                horizontalPadding,
            }}
          >

            {reminders.length >
            0 ? (
              reminders.map(
                (item) => (
                  <ReminderCard
                    key={item.id}
                    title={
                      item.text ||
                      "Reminder"
                    }
                    date={`${item.date || ""} • ${
                      item.time || ""
                    }`}
                    color={
                      item.completed
                        ? "#00e676"
                        : "#3b82f6"
                    }
                    completed={
                      item.completed
                    }
                    width={
                      reminderWidth
                    }
                    scale={scale}
                  />
                )
              )
            ) : (
              <View
                style={[
                  styles.noReminderCard,
                  {
                    width:
                      reminderWidth,
                    height:
                      125 * scale,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.noReminderText,
                    {
                      fontSize:
                        13 * scale,
                    },
                  ]}
                >
                  {t("no_reminders", "No reminders found.")}
                </Text>
              </View>
            )}

          </ScrollView>


          {/* ==================================================
              FEATURED PLACES
          ================================================== */}

          <View
            style={[
              styles.sectionHeader,
              {
                paddingHorizontal:
                  horizontalPadding,
                marginTop: 48,
                marginBottom:
                  15 * scale,
              },
            ]}
          >

            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize:
                    22 * scale,
                },
              ]}
            >
              {t("explore_places", "Featured Places")}
            </Text>

          </View>


          {allPlaces.length >
          0 ? (
            <FlatList
              data={allPlaces.slice(
                0,
                1
              )}
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              keyExtractor={(item) =>
                item.placeId
              }
              contentContainerStyle={{
                paddingHorizontal:
                  horizontalPadding,
              }}
              renderItem={({
                item,
              }) => (
                <PlaceCard
                  place={item}
                  width={
                    placeCardWidth
                  }
                  imageHeight={
                    placeImageHeight
                  }
                  scale={scale}
                  isLiked={likesData[
                    item.placeId
                  ]?.likedBy?.includes(
                    user?.uid
                  )}
                  likesCount={
                    likesData[
                      item.placeId
                    ]?.likesCount || 0
                  }
                  onLike={() =>
                    handleLike(item)
                  }
                  onPress={() =>
                    router.push({
                      pathname:
                        "/(tabs)/place-details" as any,
                      params: {
                        placeId:
                          item.placeId,
                      },
                    })
                  }
                />
              )}
            />
          ) : (
            <Text
              style={[
                styles.noDataText,
                {
                  paddingHorizontal:
                    horizontalPadding,
                  fontSize:
                    13 * scale,
                },
              ]}
            >
              {t("No featured places available.")}
            </Text>
          )}


          {/* ==================================================
              MORE PLACES
          ================================================== */}

          <View
            style={[
              styles.sectionHeader,
              {
                paddingHorizontal:
                  horizontalPadding,
                marginTop: 48,
                marginBottom:
                  15 * scale,
              },
            ]}
          >

            <Text
              style={[
                styles.sectionTitle,
                {
                  fontSize:
                    22 * scale,
                },
              ]}
            >
              {t("More Places")}
            </Text>

          </View>


          <View
            style={{
              paddingHorizontal:
                horizontalPadding,
            }}
          >

            {allPlaces
              .slice(1)
              .map((item) => (
                <PlaceCard
                  key={
                    item.placeId
                  }
                  place={item}
                  width={
                    placeCardWidth
                  }
                  imageHeight={
                    placeImageHeight
                  }
                  scale={scale}
                  isLiked={likesData[
                    item.placeId
                  ]?.likedBy?.includes(
                    user?.uid
                  )}
                  likesCount={
                    likesData[
                      item.placeId
                    ]?.likesCount || 0
                  }
                  onLike={() =>
                    handleLike(item)
                  }
                  onPress={() =>
                    router.push({
                      pathname:
                        "/(tabs)/place-details" as any,
                      params: {
                        placeId:
                          item.placeId,
                      },
                    })
                  }
                />
              ))}

          </View>


          {/* ==================================================
              FOOTER
          ================================================== */}

          <Text
            style={[
              styles.footer,
              {
                fontSize:
                  10 * scale,
                marginTop:
                  35 * scale,
              },
            ]}
          >
            BunkMate vBeta_3.0.08.100
            {"  —  "}
            Made with ❤️
          </Text>

        </ScrollView>


        {/* ====================================================
            WEATHER DETAILS
        ==================================================== */}

        <WeatherDetailsSheet
          weather={weather}
          aqiValue={aqiValue}
          airPollution={airPollution}
          visible={
            showWeatherDetails
          }
          onClose={() =>
            setShowWeatherDetails(
              false
            )
          }
        />

        <AQIDetailsSheet
          aqiValue={aqiValue}
          aqiData={aqiData}
          visible={
            showAqiDetails
          }
          onClose={() =>
            setShowAqiDetails(
              false
            )
          }
        />

      </View>
    </SafeAreaView>
  );
}


// ============================================================
// PLACE CARD
// ============================================================

function PlaceCard({
  place,
  isLiked,
  likesCount,
  onLike,
  onPress,
  width,
  imageHeight,
  scale,
}: any) {
  const router = useRouter();

  return (
    <Pressable
      style={[
        styles.placeCard,
        {
          width,
          marginBottom:
            20 * scale,
          borderRadius:
            20 * scale,
        },
      ]}
      onPress={onPress}
    >

      {/* Image */}

      <ImageBackground
        source={{
          uri:
            place.images?.[0],
        }}
        style={[
          styles.placeCardImage,
          {
            height:
              imageHeight,
          },
        ]}
        imageStyle={{
          borderRadius:
            17 * scale,
        }}
      >

        {/* Like */}

        <Pressable
          style={[
            styles.placeLikeButton,
            {
              top:
                12 * scale,
              right:
                12 * scale,
              paddingHorizontal:
                12 * scale,
              paddingVertical:
                9 * scale,
              borderRadius:
                18 * scale,
            },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            onLike();
          }}
        >

          <Ionicons
            name={
              isLiked
                ? "heart"
                : "heart-outline"
            }
            size={
              24 * scale
            }
            color="#fff"
          />

          <Text
            style={[
              styles.placeCardLikeCount,
              {
                fontSize:
                  14 * scale,
              },
            ]}
          >
            {likesCount}
          </Text>

        </Pressable>


        {/* Bookmark / Plan */}

        <Pressable
          style={[
            styles.bookmarkButton,
            {
              top:
                62 * scale,
              right:
                12 * scale,
            },
          ]}
          onPress={(event) => {
            event.stopPropagation();

            router.push({
              pathname:
                "/(tabs)/trips" as any,
              params: {
                createFromPlace:
                  place.placeId,
              },
            });
          }}
        >
          <Ionicons
            name="bookmark-outline"
            size={
              23 * scale
            }
            color="#fff"
          />
        </Pressable>

      </ImageBackground>


      {/* Place information */}

<View
  style={[
    styles.placeInfoContainer,
    {
      padding: 14 * scale,
    },
  ]}
>
  <Text
    style={[
      styles.placeTitle,
      {
        fontSize: 19 * scale,
      },
    ]}
    numberOfLines={1}
  >
    {place.name}
  </Text>


        <Text
          style={[
            styles.placeDistrict,
            {
              fontSize:
                13 * scale,
            },
          ]}
          numberOfLines={1}
        >
          {place.districtName},{" "}
          {place.stateName}
        </Text>


        <Text
          style={[
            styles.placeDescription,
            {
              fontSize:
                14 * scale,
              lineHeight:
                21 * scale,
            },
          ]}
          numberOfLines={3}
        >
          {place.description}
        </Text>

      </View>

    </Pressable>
  );
}


// ============================================================
// REMINDER CARD
// ============================================================

function ReminderCard({
  title,
  date,
  color,
  completed,
  width,
  scale,
}: any) {
  return (
    <View
      style={[
        styles.remCard,
        {
          width,
          height:
            145 * scale,
          padding:
            16 * scale,
          borderRadius:
            20 * scale,
          marginRight:
            14 * scale,
        },
      ]}
    >

      <View
        style={
          styles.remHeader
        }
      >

        <View
          style={[
            styles.remDot,
            {
              width:
                15 * scale,
              height:
                15 * scale,
              borderRadius:
                7.5 * scale,
              borderColor:
                color,
              borderWidth:
                3,
            },
          ]}
        />

        {completed && (
          <View
            style={[
              styles.completeCircle,
              {
                width:
                  38 * scale,
                height:
                  38 * scale,
                borderRadius:
                  19 * scale,
              },
            ]}
          >
            <Ionicons
              name="checkmark"
              size={
                22 * scale
              }
              color="#00e676"
            />
          </View>
        )}

      </View>


      <Text
        style={[
          styles.remTitle,
          {
            fontSize:
              18 * scale,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>


      <Text
        style={[
          styles.remDate,
          {
            fontSize:
              13 * scale,
          },
        ]}
        numberOfLines={1}
      >
        {date}
      </Text>


      <MaterialCommunityIcons
        name="calendar-blank-outline"
        size={
          62 * scale
        }
        color="rgba(255,255,255,0.035)"
        style={
          styles.remIconBg
        }
      />

    </View>
  );
}


// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },

  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  center: {
    justifyContent:
      "center",
    alignItems:
      "center",
  },

  scrollContent: {
    paddingTop: 8,
  },


  // ==========================================================
  // HEADER
  // ==========================================================

  header: {
    paddingTop: 20,
    flexDirection:
      "row",
    justifyContent:
      "space-between",
    alignItems:
      "center",
  },

  greeting: {
    color: "#ffffff",
    opacity: 0.78,
    fontWeight:
      "400",
  },

  name: {
    color: "#ffffff",
    fontWeight:
      "800",
    marginTop: 2,
  },


  // ==========================================================
  // WEATHER
  // ==========================================================

  weatherAqiRow: {
    flexDirection:
      "row",
    justifyContent:
      "space-between",
    alignItems:
      "center",
  },

  weatherInfo: {
    flexDirection:
      "row",
    alignItems:
      "center",
    flex: 1,
    marginRight: 12,
  },

  tempText: {
    color: "#ffffff",
    fontWeight:
      "700",
  },

  subText: {
    color: "#aaaaaa",
    marginTop: 4,
    textTransform:
      "capitalize",
  },

  metricSubText: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "600",
  },

  compactTileContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  compactTilePollutionBorder: {
    borderColor: "rgba(249, 115, 22, 0.4)",
  },

  compactTempText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  compactCityText: {
    color: "#cccccc",
    fontWeight: "600",
  },

  compactDescText: {
    color: "#999999",
    textTransform: "capitalize",
    fontWeight: "500",
  },

  compactMetaText: {
    color: "#777777",
    fontWeight: "500",
  },

  compactAqiPill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 54,
  },

  compactAqiNum: {
    fontSize: 16,
    fontWeight: "900",
  },

  compactAqiStatus: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 1,
  },

  homeAlertBannerSevere: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 71, 87, 0.15)",
    borderColor: "rgba(255, 71, 87, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },

  homeAlertBannerRain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },

  homeAlertBannerText: {
    color: "#ff6b81",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },

  homeAlertBannerRainText: {
    color: "#7dd3fc",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },


  // ==========================================================
  // AQI
  // ==========================================================

  aqiBadge: {
    backgroundColor:
      "rgba(0,0,0,0.2)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",
    justifyContent:
      "center",
    alignItems:
      "center",
  },

  aqiNumber: {
    color: "#ffffff",
    fontWeight:
      "800",
  },

  aqiLabel: {
    color: "#cccccc",
    marginTop: 2,
  },

  infoIcon: {
    position:
      "absolute",
    top: 10,
    right: 10,
  },


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchBar: {
    flexDirection:
      "row",
    backgroundColor:
      "rgba(255,255,255,0.045)",
    borderRadius: 25,
    alignItems:
      "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.09)",
  },

  searchText: {
    color: "#ffffff",
    marginLeft: 10,
    opacity: 0.75,
  },


  // ==========================================================
  // SECTION
  // ==========================================================

  sectionHeader: {
    flexDirection:
      "row",
    justifyContent:
      "space-between",
    alignItems:
      "center",
  },

  sectionTitle: {
    color: "#ffffff",
    fontWeight:
      "800",
  },

  viewAll: {
    color: "#f0a040",
    fontWeight:
      "700",
  },


  // ==========================================================
  // TRIPS
  // ==========================================================

  tripCardContainer: {
    overflow:
      "hidden",
  },

  tripCard: {
    width: "100%",
    overflow:
      "hidden",
    backgroundColor:
      "#161616",
  },

  tripGradient: {
    flex: 1,
    justifyContent:
      "flex-end",
  },

  tripContent: {
    justifyContent:
      "flex-end",
  },

  tripMainRow: {
    flexDirection:
      "row",
    justifyContent:
      "space-between",
    alignItems:
      "center",
  },

  tripTitle: {
    color: "#ffffff",
    fontWeight:
      "800",
    flex: 1,
    marginRight: 10,
  },

  avatarGroup: {
    flexDirection:
      "row",
    alignItems:
      "center",
  },

  miniAvatar: {
    borderWidth: 2,
    borderColor:
      "#000000",
  },

  tripSub: {
    color: "#eeeeee",
    marginTop: 7,
  },

  paginationDots: {
    flexDirection:
      "row",
    justifyContent:
      "center",
    alignItems:
      "center",
  },

  dot: {
    borderRadius: 10,
    marginHorizontal: 3,
  },

  emptyTrip: {
    height: 130,
    borderRadius: 20,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",
    justifyContent:
      "center",
    alignItems:
      "center",
    backgroundColor:
      "rgba(255,255,255,0.025)",
  },

  emptyText: {
    color: "#777777",
    marginTop: 8,
  },


  // ==========================================================
  // REMINDERS
  // ==========================================================

  remCard: {
    backgroundColor:
      "#0d0d0d",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.12)",
    overflow:
      "hidden",
  },

  remHeader: {
    flexDirection:
      "row",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    marginBottom: 18,
  },

  remDot: {
    backgroundColor:
      "transparent",
  },

  completeCircle: {
    borderWidth: 1,
    borderColor:
      "rgba(0,230,118,0.4)",
    backgroundColor:
      "rgba(0,230,118,0.05)",
    justifyContent:
      "center",
    alignItems:
      "center",
  },

  remTitle: {
    color: "#ffffff",
    fontWeight:
      "800",
  },

  remDate: {
    color: "#777777",
    marginTop: 8,
  },

  remIconBg: {
    position:
      "absolute",
    bottom: -8,
    right: -5,
  },

  noReminderCard: {
    backgroundColor:
      "#0d0d0d",
    borderRadius: 20,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.08)",
    justifyContent:
      "center",
    alignItems:
      "center",
  },

  noReminderText: {
    color: "#777777",
  },


  // ==========================================================
  // PLACE CARD
  // ==========================================================

  placeCard: {
    backgroundColor:
      "#111111",
    overflow:
      "hidden",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.06)",
  },

  placeCardImage: {
    width: "100%",
    overflow:
      "hidden",
  },

  placeLikeButton: {
    position:
      "absolute",
    flexDirection:
      "row",
    alignItems:
      "center",
    justifyContent:
      "center",
    backgroundColor:
      "rgba(40,40,40,0.65)",
    gap: 5,
  },

  bookmarkButton: {
    position:
      "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor:
      "rgba(40,40,40,0.65)",
    justifyContent:
      "center",
    alignItems:
      "center",
  },

  placeCardLikeCount: {
    color: "#ffffff",
    fontWeight:
      "700",
  },

  placeInfoContainer: {
    backgroundColor:
      "#111111",
  },

  placeTitle: {
    color: "#ffffff",
    fontWeight:
      "800",
  },

  placeDistrict: {
    color: "#999999",
    marginTop: 4,
  },

  placeDescription: {
    color: "#aaaaaa",
    marginTop: 8,
  },


  // ==========================================================
  // EMPTY / FOOTER
  // ==========================================================

  noDataText: {
    color: "#777777",
  },

  footer: {
    color: "#555555",
    textAlign:
      "center",
    fontWeight:
      "700",
    letterSpacing: 1,
    marginBottom: 20,
  },

});