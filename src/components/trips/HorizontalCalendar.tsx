import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

interface Props {
  trips: any[];
}

const DAY_WIDTH = 70;

export default function HorizontalCalendar({ trips }: Props) {
  const flatRef = useRef<FlatList>(null);
  const today = new Date();

  const [days, setDays] = useState<Date[]>([]);
  const [activeMonth, setActiveMonth] = useState("");

  // Generate initial 120 days
  useEffect(() => {
    const start = new Date();
    start.setDate(today.getDate() - 30);

    const initial = Array.from({ length: 120 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });

    setDays(initial);

    setTimeout(() => {
      flatRef.current?.scrollToIndex({
        index: 30,
        animated: false,
      });
    }, 100);
  }, []);

  // Infinite scroll forward
  const handleEndReached = () => {
    const last = days[days.length - 1];

    const more = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(last);
      d.setDate(last.getDate() + i + 1);
      return d;
    });

    setDays((prev) => [...prev, ...more]);
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const renderItem = ({ item }: { item: Date }) => {
    const isToday = isSameDay(item, today);

    const dayTrips = trips.filter((t) => {
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      return item >= start && item <= end;
    });

    const heatIntensity = Math.min(dayTrips.length * 0.15, 0.6);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.dayBox,
          isToday && styles.todayBox,
          {
            backgroundColor: isToday
              ? "#fff"
              : `rgba(255,255,255,${0.05 + heatIntensity})`,
          },
        ]}
      >
        <Text
          style={[
            styles.weekText,
            { color: isToday ? "#000" : "#aaa" },
          ]}
        >
          {item.toLocaleDateString("en-US", {
            weekday: "short",
          })}
        </Text>

        <Text
          style={[
            styles.dayText,
            { color: isToday ? "#000" : "#fff" },
          ]}
        >
          {item.getDate()}
        </Text>

        {/* Trip Dots */}
        <View style={styles.dotContainer}>
          {dayTrips.slice(0, 3).map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Month Label */}
      <View style={styles.monthLabel}>
        <Text style={styles.monthText}>
          {activeMonth}
        </Text>
      </View>

      <FlatList
        ref={flatRef}
        horizontal
        data={days}
        renderItem={renderItem}
        keyExtractor={(item) => item.toISOString()}
        showsHorizontalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        snapToInterval={DAY_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        getItemLayout={(_, index) => ({
          length: DAY_WIDTH,
          offset: DAY_WIDTH * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
    marginBottom: 15,
  },
  monthLabel: {
    position: "absolute",
    left: 20,
    top: -5,
    zIndex: 10,
  },
  monthText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
  },
  dayBox: {
    width: DAY_WIDTH,
    height: 95,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  todayBox: {
    shadowColor: "#fff",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  weekText: {
    fontSize: 11,
    marginBottom: 3,
  },
  dayText: {
    fontSize: 18,
    fontWeight: "800",
  },
  dotContainer: {
    flexDirection: "row",
    position: "absolute",
    bottom: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#4caf50",
    marginHorizontal: 2,
  },
});