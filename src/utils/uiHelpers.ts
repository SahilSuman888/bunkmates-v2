// utils/uiHelpers.ts
import { Dimensions } from 'react-native';

export const getDynamicBorderRadius = (index: number, total: number): number => {
  if (total === 1) return 20;
  if (index === 0) return 20;
  if (index === total - 1) return 20;
  return 7;
};

export const getScreenWidth = (): number => {
  return Dimensions.get('window').width;
};

export const getScreenHeight = (): number => {
  return Dimensions.get('window').height;
};

export const formatDateForInput = (date: Date | any): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  return d.toISOString().split('T')[0];
};

export const formatTimeForInput = (date: Date | any): string => {
  if (!date) return '';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  return d.toTimeString().slice(0, 5);
};

export const getAQIColor = (aqi: number): string => {
  if (aqi <= 50) return '#ffffff';
  if (aqi <= 100) return '#009E73';
  if (aqi <= 150) return '#E69F00';
  if (aqi <= 200) return '#D55E00';
  if (aqi <= 300) return '#f0300e';
  return '#7F0000';
};

export const getAQILabel = (aqi: number): string => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy';
  if (aqi <= 200) return 'Very Unhealthy';
  if (aqi <= 300) return 'Severe';
  return 'Hazardous';
};

export const triggerHaptic = (pattern: number = 10) => {
  // Haptics for React Native - will be handled by native code
  // This is a placeholder for future enhancement
};
