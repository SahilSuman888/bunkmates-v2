import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { BlurView } from '../../../components/ui/AppBlurView';
import dayjs from 'dayjs'; // Ensure dayjs is installed for easy formatting
import WeatherIcon from './WeatherIcon';

export default function HourlyForecast({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>HOURLY FORECAST</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {data.slice(0, 8).map((item, index) => (
          <BlurView key={index} intensity={20} tint="dark" style={styles.hourCard}>
            <Text style={styles.timeText}>
              {dayjs.unix(item.dt).format('HH:mm')}
            </Text>
            <WeatherIcon condition={item.weather[0].main} size={24} />
            <Text style={styles.tempText}>
              {Math.round(item.main.temp)}°
            </Text>
          </BlurView>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 20 },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 25,
    letterSpacing: 0.5,
  },
  scrollContent: { paddingLeft: 25, paddingRight: 10 },
  hourCard: {
    width: 65,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  timeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginBottom: 8 },
  tempText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
});