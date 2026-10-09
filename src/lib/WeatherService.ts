// lib/WeatherService.ts
// Industry-level Weather & AQI Service with caching, air pollution API, and EPA standard conversion
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_KEY = "c5298240cb3e71775b479a32329803ab";

// Standard EPA AQI formula from PM2.5 (ug/m3)
export function calculateAqiFromPm25(pm25: number): number {
  if (pm25 <= 12.0) return Math.round(((50 - 0) / (12.0 - 0)) * (pm25 - 0) + 0);
  if (pm25 <= 35.4) return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  if (pm25 <= 55.4) return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
  if (pm25 <= 150.4) return Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
  if (pm25 <= 250.4) return Math.round(((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201);
  if (pm25 <= 350.4) return Math.round(((400 - 301) / (350.4 - 250.5)) * (pm25 - 250.5) + 301);
  return Math.round(((500 - 401) / (500.4 - 350.5)) * (pm25 - 350.5) + 401);
}

// AQI Category helper
export function getAqiCategory(aqi: number) {
  if (aqi <= 50) {
    return {
      status: "Good",
      color: "#10B981",
      advisory: "Air quality is satisfactory. Enjoy outdoor activities.",
      severity: "low",
    };
  }
  if (aqi <= 100) {
    return {
      status: "Moderate",
      color: "#F59E0B",
      advisory: "Air quality is acceptable. Sensitive groups should consider reducing prolonged exertion.",
      severity: "moderate",
    };
  }
  if (aqi <= 150) {
    return {
      status: "Unhealthy for Sensitive Groups",
      color: "#F97316",
      advisory: "Members of sensitive groups may experience health effects. General public less likely affected.",
      severity: "high",
    };
  }
  if (aqi <= 200) {
    return {
      status: "Unhealthy",
      color: "#EF4444",
      advisory: "Some members of the general public may experience health effects. Limit outdoor activity.",
      severity: "high",
    };
  }
  if (aqi <= 300) {
    return {
      status: "Very Unhealthy",
      color: "#8B5CF6",
      advisory: "Health alert: The risk of health effects is increased for everyone.",
      severity: "severe",
    };
  }
  return {
    status: "Hazardous",
    color: "#7F1D1D",
    advisory: "Health warnings of emergency conditions. The entire population is likely to be affected.",
    severity: "severe",
  };
}

// Convert refresh interval text to milliseconds
export function parseRefreshIntervalMs(interval: string): number {
  switch (interval) {
    case "Every 30 mins":
      return 30 * 60 * 1000;
    case "Every 3 Hours":
      return 3 * 60 * 60 * 1000;
    case "Every 1 Hour":
    default:
      return 60 * 60 * 1000;
  }
}

// Fetch current weather with intelligent caching
export const fetchCurrentWeather = async (
  lat: number,
  lon: number,
  cacheMaxAgeMs: number = 30 * 60 * 1000
) => {
  const cacheKey = `@bunkmates_weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < cacheMaxAgeMs) {
        return parsed.data;
      }
    }
  } catch {}

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
  );
  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }
  const data = await res.json();

  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {}

  return data;
};

// Fetch 5-day / 3-hour forecast with caching
export const fetchForecast = async (
  lat: number,
  lon: number,
  cacheMaxAgeMs: number = 60 * 60 * 1000
) => {
  const cacheKey = `@bunkmates_forecast_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < cacheMaxAgeMs) {
        return parsed.data;
      }
    }
  } catch {}

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
  );
  if (!res.ok) {
    throw new Error(`Forecast API error: ${res.status}`);
  }
  const data = await res.json();

  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {}

  return data;
};

// Fetch real Air Pollution data (AQI + Pollutants) with caching
export const fetchAirPollution = async (
  lat: number,
  lon: number,
  cacheMaxAgeMs: number = 30 * 60 * 1000
) => {
  const cacheKey = `@bunkmates_aqi_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < cacheMaxAgeMs) {
        return parsed.data;
      }
    }
  } catch {}

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
  );
  if (!res.ok) {
    throw new Error(`Air Pollution API error: ${res.status}`);
  }
  const raw = await res.json();
  const record = raw?.list?.[0];
  const components = record?.components || {};
  const pm25 = components.pm2_5 || 15;
  const standardAqi = calculateAqiFromPm25(pm25);
  const category = getAqiCategory(standardAqi);

  const formattedData = {
    value: standardAqi,
    rawOpenWeatherAqi: record?.main?.aqi || 2, // 1 to 5 scale
    status: category.status,
    color: category.color,
    advisory: category.advisory,
    severity: category.severity,
    lastUpdated: "Just now",
    timestamp: Date.now(),
    pollutants: {
      PM25: Math.round(components.pm2_5 || 0),
      PM10: Math.round(components.pm10 || 0),
      NO2: Math.round(components.no2 || 0),
      SO2: Math.round(components.so2 || 0),
      CO: Math.round((components.co || 0) / 100) / 10,
      OZONE: Math.round(components.o3 || 0),
      NH3: Math.round(components.nh3 || 0),
    },
    rawComponents: components,
  };

  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ timestamp: Date.now(), data: formattedData })
    );
  } catch {}

  return formattedData;
};
