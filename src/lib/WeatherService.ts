// lib/WeatherService.ts
const API_KEY = "c5298240cb3e71775b479a32329803ab";

export const fetchCurrentWeather = async (lat: number, lon: number) => {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
  );
  return await res.json();
};

// Added forecast fetcher
export const fetchForecast = async (lat: number, lon: number) => {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
  );
  return await res.json();
};
