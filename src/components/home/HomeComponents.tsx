import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  Image,
  ScrollView,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { BlurView } from "../ui/AppBlurView";
import { MotiView } from "moti";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import BottomSheet from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
// ...existing code...

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - 60;

// ════════════════════════════════════════════════════════════════
// APPBAR COMPONENT
// ════════════════════════════════════════════════════════════════

interface AppBarProps {
  userName?: string;
  userType?: string;
}

export function AppBar({ userName = "Explorer", userType = "Regular" }: AppBarProps) {
  return (
    <View style={styles.appBar}>
      <View style={styles.appBarContent}>
        <Text style={styles.appBarTitle}>BunkMates</Text>
        <View style={styles.appBarRight}>
          <View style={styles.userTypeBadge}>
            <Text style={styles.userTypeText}>{userType}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// UTILITIES & CONSTANTS
// ════════════════════════════════════════════════════════════════

export const WEATHER_ICONS = {
  Clear: "weather-sunny",
  Clouds: "weather-cloudy",
  Rain: "weather-rainy",
  Thunderstorm: "weather-lightning",
  Snow: "weather-snowy",
  Mist: "weather-fog",
  Smoke: "weather-fog",
  Haze: "weather-haze",
  Dust: "weather-haze",
  Ash: "weather-haze",
  Squall: "weather-tornado",
  Tornado: "weather-tornado",
  Drizzle: "weather-rainy",
};

export const AQI_SCALE = [
  { label: "Good", max: 50, color: "#10b981" },
  { label: "Moderate", max: 100, color: "#f59e0b" },
  { label: "Unhealthy for Sensitive Groups", max: 150, color: "#f97316" },
  { label: "Unhealthy", max: 200, color: "#ef4444" },
  { label: "Very Unhealthy", max: 300, color: "#8b5cf6" },
  { label: "Hazardous", max: 500, color: "#7c2d12" },
];

export const getAQIDetails = (value: number) => {
  const detail = AQI_SCALE.find((item) => value <= item.max);
  return detail || AQI_SCALE[AQI_SCALE.length - 1];
};

// ════════════════════════════════════════════════════════════════
// ANIMATED BACKGROUND COMPONENT
// ════════════════════════════════════════════════════════════════

interface AnimatedBackgroundProps {
  weather?: string;
}

export function AnimatedBackground({ weather }: AnimatedBackgroundProps) {
  const colors = useMemo(() => {
    switch (weather) {
      case "Rain":
        return ["#1e3c72", "#2a5298"];
      case "Clouds":
        return ["#232526", "#414345"];
      case "Clear":
        return ["#0f2027", "#2c5364"];
      case "Thunderstorm":
        return ["#141E30", "#243B55"];
      case "Snow":
        return ["#83a4d4", "#b6fbff"];
      default:
        return ["#0f0c29", "#302b63", "#24243e"];
    }
  }, [weather]);

  return (
    <MotiView
      from={{ scale: 1 }}
      animate={{ scale: 1.1 }}
      transition={{
        type: "timing",
        duration: 10000,
        loop: true,
      }}
      style={styles.backgroundContainer}
    >
      <LinearGradient colors={colors as any} style={styles.gradient} />
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// GREETING SECTION COMPONENT
// ════════════════════════════════════════════════════════════════

interface GreetingSectionProps {
  userName: string;
  greeting: string;
}

export function GreetingSection({ userName, greeting }: GreetingSectionProps) {
  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 200 }}
    >
      <MotiView
        from={{ translateY: -20 }}
        animate={{ translateY: 0 }}
        transition={{ delay: 400 }}
      >
        <Text style={styles.greeting}>{greeting}</Text>
      </MotiView>

      <MotiView
        from={{ translateY: -20 }}
        animate={{ translateY: 0 }}
        transition={{ delay: 600 }}
      >
        <Text style={styles.greetingName}>{userName}</Text>
      </MotiView>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// WEATHER CARD COMPONENT
// ════════════════════════════════════════════════════════════════

interface WeatherData {
  main?: string;
  desc?: string;
  temp?: number;
  city?: string;
  humidity?: number;
  feelsLike?: number;
}

interface WeatherCardProps {
  weather: WeatherData | null;
  loading: boolean;
}

export function WeatherCard({ weather, loading }: WeatherCardProps) {
  if (loading) {
    return (
      <BlurView intensity={40} tint="dark" style={styles.weatherCard}>
        <ActivityIndicator size="small" color="#fff" />
      </BlurView>
    );
  }

  if (!weather) {
    return (
      <BlurView intensity={40} tint="dark" style={styles.weatherCard}>
        <Text style={styles.weatherCardText}>Weather unavailable</Text>
      </BlurView>
    );
  }

  const iconName = (WEATHER_ICONS as any)[weather.main] || "weather-cloudy";

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: 800 }}
    >
      <BlurView intensity={40} tint="dark" style={styles.weatherCard}>
        <View style={styles.weatherCardContent}>
          <MaterialCommunityIcons name={iconName} size={40} color="#fff" />

          <View style={styles.weatherCardInfo}>
            <Text style={styles.weatherCardTemp}>{weather.temp}°</Text>
            <Text style={styles.weatherCardDesc}>{weather.desc}</Text>
          </View>
        </View>

        <View style={styles.weatherCardBottom}>
          <Text style={styles.weatherCardCity}>{weather.city}</Text>
          <Text style={styles.weatherCardMeta}>
            Humidity {weather.humidity}% | Feels {weather.feelsLike}°
          </Text>
        </View>
      </BlurView>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// AQI WIDGET COMPONENT
// ════════════════════════════════════════════════════════════════

interface AQIDataType {
  station?: string;
  city?: string;
  maxAqi?: number;
}

interface AQIWidgetProps {
  aqiData: AQIDataType | null;
  loading: boolean;
}

export function AQIWidget({ aqiData, loading }: AQIWidgetProps) {
  if (loading) {
    return (
      <BlurView intensity={40} tint="dark" style={styles.aqiWidget}>
        <ActivityIndicator size="small" color="#fff" />
      </BlurView>
    );
  }

  const aqi = aqiData?.maxAqi || 0;
  const details = getAQIDetails(aqi);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay: 900 }}
    >
      <BlurView intensity={40} tint="dark" style={styles.aqiWidget}>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.aqiValue, { color: details.color }]}>
            {aqi}
          </Text>
          <Text style={[styles.aqiStatus, { color: details.color }]}>
            {details.label}
          </Text>
          <Text style={styles.aqiCity}>{aqiData?.city || "Unknown"}</Text>
        </View>
      </BlurView>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// QUICK TILES COMPONENT
// ════════════════════════════════════════════════════════════════

const TILES = [
  { label: "Notes", icon: "note-text-outline", route: "/(tabs)/home", color: "#ffb300", bgColor: "#fffbe6" },
  { label: "Reminder", icon: "alarm-outline", route: "/(tabs)/home", color: "#1976d2", bgColor: "#e3f2fd" },
  { label: "Trip", icon: "earth", route: "/(tabs)/home", color: "#43a047", bgColor: "#e8f5e9" },
  { label: "Budget", icon: "wallet-outline", route: "/(tabs)/home", color: "#d81b60", bgColor: "#fce4ec" },
];

export function QuickTiles() {
  return (
    <View style={styles.tilesContainer}>
      {TILES.map((item, index) => (
        <MotiView
          key={item.label}
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 800 + index * 150 }}
          style={styles.tileWrapper}
        >
          <Pressable
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [
              styles.tilePressable,
              pressed && { backgroundColor: "#232526" },
            ]}
          >
            <View style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: item.bgColor }]}>
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={24}
                  color={item.color}
                />
              </View>
              <Text style={styles.tileLabel}>{item.label}</Text>
            </View>
          </Pressable>
        </MotiView>
      ))}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// WEATHER DETAILS SHEET COMPONENT
// ════════════════════════════════════════════════════════════════

interface WeatherDetailsProps {
  weather: any | null;
  open: boolean;
  onClose: () => void;
}

function DataRow({ label, value, unit }: any) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataRowLabel}>{label}</Text>
      <Text style={styles.dataRowValue}>
        {value}
        {unit && <Text style={styles.dataRowUnit}> {unit}</Text>}
      </Text>
    </View>
  );
}

export function WeatherDetailsSheet({
  weather,
  open,
  onClose,
}: WeatherDetailsProps) {
  const snapPoints = [height * 0.6, height * 0.95];

  if (!weather) return null;

  const formatTime = (unix: number) => {
    return new Date(unix * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <BottomSheet snapPoints={snapPoints} onClose={onClose} enablePanDownToClose>
      <BlurView intensity={90} style={styles.sheetContainer}>
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Weather Details</Text>
            <Pressable onPress={onClose} style={styles.sheetCloseButton}>
              <MaterialCommunityIcons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          {/* Main temp */}
          <View style={styles.tempSection}>
            <Text style={styles.mainTemp}>{weather.temp}°C</Text>
            <Text style={styles.tempDesc}>{weather.desc}</Text>
            {weather.city && (
              <Text style={styles.tempCity}>
                {weather.city}
                {weather.country && `, ${weather.country}`}
              </Text>
            )}
          </View>

          {/* Data Grid */}
          <View style={styles.gridContainer}>
            <View style={styles.gridRow}>
              <DataRow
                label="Feels Like"
                value={weather.feelsLike}
                unit="°C"
              />
              <DataRow label="Humidity" value={weather.humidity} unit="%" />
            </View>

            <View style={styles.gridRow}>
              <DataRow label="Pressure" value={weather.pressure} unit="hPa" />
              <DataRow
                label="Visibility"
                value={(weather.visibility / 1000).toFixed(1)}
                unit="km"
              />
            </View>

            <View style={styles.gridRow}>
              <DataRow
                label="Cloud Cover"
                value={weather.clouds}
                unit="%"
              />
              <DataRow
                label="Wind Speed"
                value={weather.windSpeed}
                unit="m/s"
              />
            </View>

            <View style={styles.gridRow}>
              <DataRow
                label="Wind Direction"
                value={weather.windDeg}
                unit="°"
              />
              <DataRow
                label="Wind Gust"
                value={weather.windGust}
                unit="m/s"
              />
            </View>

            <View style={styles.gridRow}>
              <DataRow label="Rain (1h)" value={weather.rain} unit="mm" />
              <DataRow label="Snow (1h)" value={weather.snow} unit="mm" />
            </View>

            {weather.sunrise && (
              <View style={styles.gridRow}>
                <DataRow label="Sunrise" value={formatTime(weather.sunrise)} />
                <DataRow label="Sunset" value={formatTime(weather.sunset)} />
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </BlurView>
    </BottomSheet>
  );
}

// ════════════════════════════════════════════════════════════════
// REMINDERS CAROUSEL COMPONENT
// ════════════════════════════════════════════════════════════════

interface Reminder {
  id: string;
  text?: string;
  title?: string;
  time?: string;
  date?: string;
  dueAt?: any;
  completed?: boolean;
}

interface RemindersCarouselProps {
  reminders: Reminder[];
  onViewAll?: () => void;
}

export function RemindersCarousel({
  reminders,
  onViewAll,
}: RemindersCarouselProps) {
  const [scrollIndex, setScrollIndex] = useState(0);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / CARD_WIDTH);
    setScrollIndex(currentIndex);
  };

  const sortedReminders = [...reminders]
    .sort((a, b) => {
      const timeA = a.dueAt?.toMillis?.() ?? new Date(a.dueAt).getTime();
      const timeB = b.dueAt?.toMillis?.() ?? new Date(b.dueAt).getTime();
      return timeB - timeA;
    })
    .slice(0, 4);

  const ReminderCard = ({ item, index }: { item: Reminder; index: number }) => {
    const isCompleted = item.completed === true;
    const accent = isCompleted ? "#22c55e" : "#60a5fa";

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 100 }}
      >
        <BlurView intensity={40} tint="dark" style={styles.reminderCard}>
          <View
            style={[
              styles.reminderCardContent,
              {
                backgroundColor: isCompleted ? "#22c55e15" : "#60a5fa15",
              },
            ]}
          >
            {/* Checkbox */}
            <View
              style={[
                styles.reminderCheckbox,
                {
                  backgroundColor: isCompleted ? accent : "transparent",
                  borderColor: accent,
                },
              ]}
            >
              {isCompleted && (
                <MaterialCommunityIcons
                  name="check"
                  size={16}
                  color="#fff"
                />
              )}
            </View>

            {/* Text Content */}
            <View style={styles.reminderTextContainer}>
              <Text
                style={[
                  styles.reminderText,
                  {
                    textDecorationLine: isCompleted ? "line-through" : "none",
                  },
                ]}
                numberOfLines={2}
              >
                {item.text || item.title || "Reminder"}
              </Text>

              {item.time && (
                <Text style={styles.reminderTimeText}>{item.time}</Text>
              )}
            </View>

            {/* Indicator */}
            <View
              style={[
                styles.reminderIndicator,
                { backgroundColor: accent },
              ]}
            />
          </View>
        </BlurView>
      </MotiView>
    );
  };

  return (
    <View style={styles.remindersContainer}>
      {/* Header */}
      <View style={styles.remindersHeader}>
        <Text style={styles.remindersSectionTitle}>Reminders</Text>
        <Pressable onPress={onViewAll} style={styles.remindersViewAllButton}>
          <Text style={styles.remindersViewAllText}>View All</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color="#888"
          />
        </Pressable>
      </View>

      {/* Carousel */}
      <FlatList
        data={sortedReminders}
        renderItem={({ item, index }) => (
          <ReminderCard item={item} index={index} />
        )}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.reminderCarouselContent}
        keyExtractor={(item) => item.id}
      />

      {/* Indicators */}
      {sortedReminders.length > 1 && (
        <View style={styles.remindersIndicatorsContainer}>
          {sortedReminders.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.remindersDot,
                {
                  width: idx === scrollIndex ? 24 : 6,
                  backgroundColor:
                    idx === scrollIndex ? "#fff" : "rgba(255,255,255,0.3)",
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// PLACES CAROUSEL COMPONENT
// ════════════════════════════════════════════════════════════════

interface Place {
  id: string;
  name?: string;
  description?: string;
  images?: string[];
  city?: string;
  state?: string;
  location?: string;
}

interface PlacesCarouselProps {
  places: Place[];
  onPlacePress?: (place: Place) => void;
}

export function PlacesCarousel({
  places,
  onPlacePress,
}: PlacesCarouselProps) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / CARD_WIDTH);
    setScrollIndex(currentIndex);
  };

  const displayPlaces = places.slice(0, 8);

  const PlaceCard = ({ item, index }: { item: Place; index: number }) => {
    const isLiked = liked[item.id] || false;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ delay: index * 100 }}
      >
        <Pressable
          onPress={() => onPlacePress?.(item)}
          style={styles.placeCardContainer}
        >
          {/* Image */}
          <Image
            source={{
              uri: item.images?.[0] || "https://via.placeholder.com/300",
            }}
            style={styles.placeImage}
          />

          {/* Overlay */}
          <View style={styles.placeOverlay} />

          {/* Like Button */}
          <Pressable
            onPress={() => setLiked({ ...liked, [item.id]: !isLiked })}
            style={styles.placeLikeButton}
          >
            <MaterialCommunityIcons
              name={isLiked ? "heart" : "heart-outline"}
              size={24}
              color={isLiked ? "#ef4444" : "#fff"}
            />
          </Pressable>

          {/* Content */}
          <BlurView intensity={40} tint="dark" style={styles.placeContent}>
            <Text style={styles.placeName} numberOfLines={1}>
              {item.name}
            </Text>

            <Text style={styles.placeDescription} numberOfLines={2}>
              {item.description}
            </Text>

            {item.location && (
              <View style={styles.placeLocationRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color="#aaa"
                />
                <Text style={styles.placeLocation} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            )}
          </BlurView>
        </Pressable>
      </MotiView>
    );
  };

  return (
    <View style={styles.placesContainer}>
      {/* Header */}
      <View style={styles.placesHeader}>
        <Text style={styles.placesSectionTitle}>Featured Places</Text>
        <Pressable style={styles.placesViewAllButton}>
          <Text style={styles.placesViewAllText}>See More</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color="#888"
          />
        </Pressable>
      </View>

      {/* Carousel */}
      <FlatList
        data={displayPlaces}
        renderItem={({ item, index }) => (
          <PlaceCard item={item} index={index} />
        )}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.placeCarouselContent}
        keyExtractor={(item) => item.id}
      />

      {/* Indicators */}
      {displayPlaces.length > 1 && (
        <View style={styles.placesIndicatorsContainer}>
          {displayPlaces.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.placesDot,
                {
                  width: idx === scrollIndex ? 24 : 6,
                  backgroundColor:
                    idx === scrollIndex ? "#fff" : "rgba(255,255,255,0.3)",
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// TRIPS CAROUSEL COMPONENT
// ════════════════════════════════════════════════════════════════

interface Trip {
  id: string;
  name: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  from?: string;
  to?: string;
  members?: string[];
}

interface TripsCarouselProps {
  trips: Trip[];
  tripMembers?: Record<string, any[]>;
  onTripPress?: (tripId: string) => void;
}

export function TripsCarousel({
  trips,
  tripMembers = {},
  onTripPress,
}: TripsCarouselProps) {
  const renderItem = ({ item, index }: { item: Trip; index: number }) => {
    const members = tripMembers[item.id] || [];

    return (
      <MotiView
        from={{ opacity: 0, translateX: 50 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ delay: 200 * index }}
      >
        <Pressable
          onPress={() => onTripPress?.(item.id)}
          style={styles.tripCardContainer}
        >
          {/* Gradient Overlay */}
          <View style={styles.tripGradientOverlay} />

          {/* Content */}
          <BlurView intensity={40} tint="dark" style={styles.tripContent}>
            {/* Header */}
            <View style={styles.tripHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripName} numberOfLines={1}>
                  {item.name || "Unnamed Trip"}
                </Text>

                <Text style={styles.tripDestination} numberOfLines={1}>
                  {item.location ||
                    (item.from && item.to && `${item.from} → ${item.to}`) ||
                    "Unknown"}
                </Text>
              </View>

              {members.length > 0 && (
                <View style={styles.tripMemberAvatars}>
                  {members.slice(0, 2).map((member, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.tripAvatar,
                        { marginLeft: idx > 0 ? -8 : 0, zIndex: 2 - idx },
                      ]}
                    >
                      <Image
                        source={{
                          uri: member.photoURL ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${member.uid}`,
                        }}
                        style={styles.tripAvatarImage}
                      />
                    </View>
                  ))}
                  {members.length > 2 && (
                    <View style={[styles.tripAvatar, { marginLeft: -8 }]}>
                      <Text style={styles.tripAvatarText}>
                        +{members.length - 2}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Date Info */}
            {item.startDate && (
              <View style={styles.tripDateRow}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={14}
                  color="#aaa"
                />
                <Text style={styles.tripDateText}>
                  {item.startDate}
                  {item.endDate && ` - ${item.endDate}`}
                </Text>
              </View>
            )}

            {/* Action Button */}
            <Pressable style={styles.tripButton}>
              <Text style={styles.tripButtonText}>View Details</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color="#000"
                style={{ marginLeft: 6 }}
              />
            </Pressable>
          </BlurView>
        </Pressable>
      </MotiView>
    );
  };

  if (trips.length === 0) {
    return (
      <View style={styles.tripsEmptyContainer}>
        <MaterialCommunityIcons
          name="airplane"
          size={48}
          color="rgba(255,255,255,0.2)"
        />
        <Text style={styles.tripsEmptyText}>No trips yet</Text>
        <Text style={styles.tripsEmptySubtext}>Start planning an adventure!</Text>
      </View>
    );
  }

  return (
    <View style={styles.tripsContainer}>
      <View style={styles.tripsHeaderRow}>
        <Text style={styles.tripsSectionTitle}>Your Trips</Text>
        <Text style={styles.tripsTripCount}>{trips.length}</Text>
      </View>

      <FlatList
        data={trips}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.tripsListContent}
        scrollEventThrottle={16}
        snapToInterval={width - 60 + 12}
        decelerationRate="fast"
      />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// LIVE ALERTS PANEL COMPONENT
// ════════════════════════════════════════════════════════════════

interface Alert {
  id: string;
  name: string;
  from?: string;
  to?: string;
  start?: Date | string;
  end?: Date | string;
  priority?: string;
}

interface LiveAlertsPanelProps {
  alerts: {
    ongoing: Alert[];
    upcoming: Alert[];
  };
}

export function LiveAlertsPanel({ alerts }: LiveAlertsPanelProps) {
  if (!alerts.ongoing.length && !alerts.upcoming.length) {
    return null;
  }

  const renderAlert = (alert: Alert, type: "ongoing" | "upcoming") => {
    const isOngoing = type === "ongoing";
    const colors = {
      ongoing: {
        bg: "#22c55e15",
        border: "#22c55e",
        icon: "#22c55e",
        text: "#22c55e",
      },
      upcoming: {
        bg: "#60a5fa15",
        border: "#60a5fa",
        icon: "#60a5fa",
        text: "#60a5fa",
      },
    };
    const color = colors[type];

    return (
      <MotiView
        key={alert.id}
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
      >
        <BlurView intensity={40} tint="dark" style={styles.alertCard}>
          <View
            style={[
              styles.alertContent,
              {
                backgroundColor: color.bg,
                borderColor: color.border,
              },
            ]}
          >
            {/* Icon */}
            <View
              style={[
                styles.alertIconCircle,
                { backgroundColor: `${color.text}22` },
              ]}
            >
              <MaterialCommunityIcons
                name={isOngoing ? "play-circle" : "clock"}
                size={20}
                color={color.text}
              />
            </View>

            {/* Text Content */}
            <View style={styles.alertTextContent}>
              <Text style={styles.alertName} numberOfLines={1}>
                {alert.name}
              </Text>

              <Text style={styles.alertRoute} numberOfLines={1}>
                {alert.from} → {alert.to}
              </Text>
            </View>

            {/* Badge */}
            <View
              style={[
                styles.alertBadge,
                {
                  backgroundColor: `${color.text}22`,
                },
              ]}
            >
              <Text
                style={[
                  styles.alertBadgeText,
                  {
                    color: color.text,
                  },
                ]}
              >
                {isOngoing ? "LIVE" : "SOON"}
              </Text>
            </View>
          </View>
        </BlurView>
      </MotiView>
    );
  };

  return (
    <View style={styles.alertsContainer}>
      {/* Ongoing Alerts */}
      {alerts.ongoing.length > 0 && (
        <View style={styles.alertsSectionContainer}>
          <View style={styles.alertsSectionHeader}>
            <MaterialCommunityIcons name="fire" size={16} color="#22c55e" />
            <Text style={styles.alertsSectionTitle}>Ongoing Trips</Text>
            <View style={styles.alertsSectionBadge}>
              <Text style={styles.alertsSectionBadgeText}>
                {alerts.ongoing.length}
              </Text>
            </View>
          </View>

          {alerts.ongoing.map((alert) => renderAlert(alert, "ongoing"))}
        </View>
      )}

      {/* Upcoming Alerts */}
      {alerts.upcoming.length > 0 && (
        <View style={styles.alertsSectionContainer}>
          <View style={styles.alertsSectionHeader}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color="#60a5fa"
            />
            <Text style={styles.alertsSectionTitle}>Upcoming (12h)</Text>
            <View style={styles.alertsSectionBadge}>
              <Text style={styles.alertsSectionBadgeText}>
                {alerts.upcoming.length}
              </Text>
            </View>
          </View>

          {alerts.upcoming.map((alert) => renderAlert(alert, "upcoming"))}
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// BUDGET CAROUSEL COMPONENT
// ════════════════════════════════════════════════════════════════

interface BudgetItem {
  id: string;
  name: string;
  balance?: string;
  total?: string;
  contributors?: number;
  icon?: string;
  color?: string;
}

interface BudgetCarouselProps {
  budgets?: BudgetItem[];
  onViewAll?: () => void;
}

export function BudgetCarousel({
  budgets = [],
  onViewAll,
}: BudgetCarouselProps) {
  if (budgets.length === 0) {
    return (
      <View style={styles.budgetSection}>
        <View style={styles.budgetHeader}>
          <Text style={styles.budgetTitle}>Budget Tracker</Text>
          <Pressable onPress={onViewAll} style={styles.budgetViewMore}>
            <Text style={styles.budgetViewMoreText}>View More</Text>
          </Pressable>
        </View>
        <Text style={styles.budgetEmpty}>No budgets created yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.budgetSection}>
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetTitle}>Budget Tracker</Text>
        <Pressable onPress={onViewAll} style={styles.budgetViewMore}>
          <Text style={styles.budgetViewMoreText}>View More</Text>
        </Pressable>
      </View>

      <FlatList
        data={budgets}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.budgetList}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.budgetItem}>
            {item.icon && (
              <View
                style={[
                  styles.budgetItemIcon,
                  { backgroundColor: item.color || "#666" },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={20}
                  color="#fff"
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.budgetItemHeader}>
                <Text style={styles.budgetItemName}>{item.name}</Text>
                {item.contributors !== undefined && (
                  <Text style={styles.budgetItemContributors}>
                    {item.contributors} member{item.contributors !== 1 ? "s" : ""}
                  </Text>
                )}
              </View>
              <View style={styles.budgetItemFooter}>
                <Text style={styles.budgetItemBalance}>{item.balance}</Text>
                {item.total && (
                  <Text style={styles.budgetItemTotal}> / {item.total}</Text>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// FLOATING CHAT BUTTON COMPONENT
// ════════════════════════════════════════════════════════════════

export function FloatingChatButton() {
  return (
    <MotiView
      from={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1200 }}
      style={styles.floatingChatContainer}
    >
      <Pressable
        onPress={() => {
          // TODO: Navigate to chats screen
        }}
        style={({ pressed }) => [
          styles.floatingChatButton,
          pressed && { transform: [{ scale: 0.9 }] },
        ]}
      >
        <MaterialCommunityIcons
          name="chat-outline"
          size={28}
          color="#000"
        />
      </Pressable>
    </MotiView>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // AppBar
  appBar: {
    backgroundColor: "transparent",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderBottomWidth: 0,
  },
  appBarContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appBarTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
  },
  appBarRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  userTypeBadge: {
    backgroundColor: "rgba(241,241,241,0.19)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  userTypeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
  },

  // Background
  backgroundContainer: {
    position: "absolute",
    width,
    height,
  },
  gradient: {
    flex: 1,
  },

  // Weather Section
  weatherSection: {
    marginBottom: 32,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  weatherContainer: {
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  weatherGreeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
    gap: 16,
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  greetingName: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "800",
    marginTop: 4,
  },
  weatherWidget: {
    backgroundColor: "rgba(34,45,70,0.8)",
    padding: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: "center",
    gap: 8,
    minWidth: 170,
  },
  weatherWidgetContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weatherTemp: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  weatherDesc: {
    fontSize: 12,
    color: "#BDBDBD",
  },

  // Greeting Section (updated)
  greeting: {
    fontSize: 14,
    color: "#aaa",
    fontWeight: "500",
  },
  greetingNameOld: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 24,
  },

  // Weather Card (keep existing)
  weatherCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  weatherCardContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  weatherCardInfo: {
    flex: 1,
  },
  weatherCardTemp: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  weatherCardDesc: {
    fontSize: 12,
    color: "#aaa",
    textTransform: "capitalize",
  },
  weatherCardBottom: {
    gap: 4,
  },
  weatherCardCity: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
  },
  weatherCardMeta: {
    fontSize: 10,
    color: "#777",
  },
  weatherCardText: {
    fontSize: 12,
    color: "#aaa",
  },

  // AQI Widget
  aqiWidget: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  aqiValue: {
    fontSize: 32,
    fontWeight: "900",
  },
  aqiStatus: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  aqiCity: {
    fontSize: 10,
    color: "#888",
    marginTop: 4,
  },

  // Quick Tiles (updated styling)
  tilesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  tileWrapper: {
    width: "23%",
    aspectRatio: 1,
  },
  tilePressable: {
    borderRadius: 24,
    overflow: "hidden",
    flex: 1,
  },
  tile: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(241,241,241,0.07)",
    flex: 1,
    gap: 6,
  },
  tileLabel: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 11,
    textAlign: "center",
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // Budget Section
  budgetSection: {
    marginVertical: 24,
    paddingHorizontal: 20,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  budgetViewMore: {
    backgroundColor: "transparent",
    paddingHorizontal: 8,
  },
  budgetViewMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00f721",
  },
  budgetList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  budgetItem: {
    backgroundColor: "rgba(68,68,68,0.92)",
    borderRadius: 8,
    padding: 12,
    minWidth: 160,
    maxWidth: 200,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  budgetItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  budgetItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  budgetItemName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  budgetItemContributors: {
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(241,241,241,0.07)",
    color: "#aaa",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  budgetItemFooter: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  budgetItemBalance: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  budgetItemTotal: {
    fontSize: 12,
    fontWeight: "400",
    color: "#BDBDBD",
    marginLeft: 4,
  },
  budgetEmpty: {
    color: "#BDBDBD",
    fontSize: 14,
    paddingHorizontal: 20,
  },

  // Weather Details Sheet
  sheetContainer: {
    flex: 1,
    backgroundColor: "rgba(12,12,12,0.8)",
  },
  sheetContent: {
    padding: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  tempSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  mainTemp: {
    fontSize: 56,
    fontWeight: "900",
    color: "#fff",
  },
  tempDesc: {
    fontSize: 14,
    color: "#aaa",
    textTransform: "capitalize",
    marginTop: 4,
  },
  tempCity: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
  },
  gridContainer: {
    gap: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  dataRow: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  dataRowLabel: {
    fontSize: 11,
    color: "#aaa",
    fontWeight: "600",
    marginBottom: 4,
  },
  dataRowValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  dataRowUnit: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
  },

  // Reminders Carousel
  remindersContainer: {
    marginVertical: 24,
  },
  remindersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  remindersSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  remindersViewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  remindersViewAllText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
  },
  reminderCarouselContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  reminderCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    overflow: "hidden",
  },
  reminderCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  reminderCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  reminderTimeText: {
    fontSize: 11,
    color: "#aaa",
  },
  reminderIndicator: {
    width: 3,
    height: 40,
    borderRadius: 2,
  },
  remindersIndicatorsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  remindersDot: {
    height: 4,
    borderRadius: 2,
  },

  // Places Carousel
  placesContainer: {
    marginVertical: 24,
  },
  placesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  placesSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  placesViewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  placesViewAllText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
  },
  placeCarouselContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  placeCardContainer: {
    width: CARD_WIDTH,
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
  },
  placeImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  placeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  placeLikeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  placeContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  placeName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  placeDescription: {
    fontSize: 12,
    color: "#ddd",
    marginBottom: 8,
    lineHeight: 16,
  },
  placeLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  placeLocation: {
    fontSize: 11,
    color: "#aaa",
    flex: 1,
  },
  placesIndicatorsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  placesDot: {
    height: 4,
    borderRadius: 2,
  },

  // Trips Carousel
  tripsContainer: {
    marginVertical: 24,
  },
  tripsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tripsSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  tripsTripCount: {
    fontSize: 12,
    color: "#888",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tripsListContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tripCardContainer: {
    width: CARD_WIDTH,
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
  },
  tripGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  tripContent: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  tripDestination: {
    fontSize: 12,
    color: "#ddd",
  },
  tripMemberAvatars: {
    flexDirection: "row",
  },
  tripAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#0c0c0c",
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  tripAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  tripAvatarText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  tripDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  tripDateText: {
    fontSize: 11,
    color: "#aaa",
  },
  tripButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tripButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  tripsEmptyContainer: {
    marginVertical: 24,
    alignItems: "center",
    paddingVertical: 40,
  },
  tripsEmptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginTop: 12,
  },
  tripsEmptySubtext: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },

  // Live Alerts Panel
  alertsContainer: {
    marginVertical: 24,
    paddingHorizontal: 20,
  },
  alertsSectionContainer: {
    marginBottom: 20,
  },
  alertsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 0,
    gap: 8,
  },
  alertsSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  alertsSectionBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertsSectionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  alertCard: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  alertTextContent: {
    flex: 1,
  },
  alertName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  alertRoute: {
    fontSize: 11,
    color: "#aaa",
  },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Floating Chat Button
  floatingChatContainer: {
    position: "absolute",
    bottom: 24,
    right: 24,
  },
  floatingChatButton: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#00f721",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
});
