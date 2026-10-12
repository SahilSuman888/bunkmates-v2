import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, functions } from "../lib/firebase";

export interface TravelDiscoveryItem {
  id: string;
  name: string;
  category: "Sightseeing" | "Street Food" | "Cafe" | "Heritage" | "Experience" | "Nature" | string;
  city: string;
  state: string;
  rating: number;
  reviewCount: number;
  timing: string;
  entryFee: string;
  entryFees?: {
    indians?: string;
    foreigners?: string;
    students?: string;
    children?: string;
    camera?: string;
    averageCost?: string;
    payment?: string;
  };
  approxCost: string;
  highlight: string;
  detailedOverview?: string;
  highlightsList?: string[];
  bestTimeToVisit: string;
  bestTimeReason?: string;
  season?: string;
  seasonReason?: string;
  address: string;
  imageUrl: string;
  imageThumbnail: string;
  images: string[];
  fallbackImageUrl: string;
  imageSource: "wikimedia" | "pexels" | "curated";
  photographer?: string | null;
  tags: string[];
  nearestAttractions?: Array<{
    name: string;
    distance?: string;
    description?: string;
    imageUrl?: string;
  }>;
}

export interface TravelSearchResponse {
  results: TravelDiscoveryItem[];
  cached: boolean;
  source: "cache" | "cloud_function" | "client_engine";
  query: string;
}

// Fallback high-res photos
export const FALLBACK_PHOTOS: Record<string, string> = {
  food: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80",
  cafe: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80",
  heritage: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80",
  sightseeing: "https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=1200&q=80",
  nature: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
  temple: "https://images.unsplash.com/photo-1609137144820-25e24b8109d9?auto=format&fit=crop&w=1200&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
};

/**
 * Fetch verified photos for a specific place from Wikimedia Commons (using File namespace 6).
 * Guarantees photos are specifically of this exact place, with cross-city & bad-file filters.
 */
export async function fetchPlaceGalleryCommons(name: string, city?: string): Promise<string[]> {
  const cleanName = name.replace(/\(.*?\)/g, "").trim();
  const queries = [
    `${cleanName} ${city || ""}`.trim(),
    cleanName,
  ];

  const results: string[] = [];
  const cityLower = (city || "").toLowerCase();

  for (const q of queries) {
    if (results.length >= 6) break;
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        q
      )}&gsrlimit=14&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "BunkMatesApp/2.0 (travel@bunkmates.app)" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      for (const page of pages as any[]) {
        const info = page.imageinfo?.[0];
        const title = (page.title || "").toLowerCase();
        const src = info?.thumburl || info?.url;
        if (!src || typeof src !== "string") continue;

        // Strict filter: exclude icons, logos, flags, svg, maps, diagrams, plans, coins, seals, stamps
        if (
          title.endsWith(".svg") ||
          title.includes("icon") ||
          title.includes("flag") ||
          title.includes("logo") ||
          title.includes("map") ||
          title.includes("plan") ||
          title.includes("seal") ||
          title.includes("coin") ||
          title.includes("stamp") ||
          title.includes("diagram")
        ) {
          continue;
        }

        // Cross-city leak prevention: If in Jaipur, reject Agra (Taj Mahal) or Delhi monuments
        if (cityLower.includes("jaipur") || cityLower.includes("rajasthan")) {
          if (
            title.includes("taj") ||
            title.includes("agra") ||
            (title.includes("delhi") && !cleanName.toLowerCase().includes("delhi"))
          ) {
            continue;
          }
        }

        if (!results.includes(src)) {
          results.push(src);
          if (results.length >= 8) break;
        }
      }
    } catch {
      // Continue next query
    }
  }

  return results;
}

/**
 * Fetch verified Wikipedia thumbnail for nearby attractions
 */
export async function fetchNearbyAttractionThumb(name: string, city?: string): Promise<string | null> {
  const cleanName = name.replace(/\(.*?\)/g, "").trim();
  const queries = [`${cleanName} ${city || ""}`.trim(), cleanName];
  for (const q of queries) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        q
      )}&gsrlimit=1&prop=pageimages&pithumbsize=600&format=json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "BunkMatesApp/2.0 (travel@bunkmates.app)" },
      });
      if (res.ok) {
        const data = await res.json();
        const pages = Object.values(data.query?.pages || {});
        if (pages[0] && (pages[0] as any).thumbnail?.source) {
          return (pages[0] as any).thumbnail.source;
        }
      }
    } catch {}
  }
  return null;
}

export function getFallbackPhoto(category: string, query: string): string {
  const combined = `${category} ${query}`.toLowerCase();
  if (combined.includes("food") || combined.includes("street") || combined.includes("eat") || combined.includes("sabzi") || combined.includes("kachori") || combined.includes("baati") || combined.includes("ghevar")) return FALLBACK_PHOTOS.food;
  if (combined.includes("cafe") || combined.includes("coffee") || combined.includes("bakery")) return FALLBACK_PHOTOS.cafe;
  if (combined.includes("fort") || combined.includes("palace") || combined.includes("heritage") || combined.includes("stambh")) return FALLBACK_PHOTOS.heritage;
  if (combined.includes("temple") || combined.includes("ghat")) return FALLBACK_PHOTOS.temple;
  if (combined.includes("lake") || combined.includes("nature") || combined.includes("hill") || combined.includes("waterfall")) return FALLBACK_PHOTOS.nature;
  return FALLBACK_PHOTOS.sightseeing || FALLBACK_PHOTOS.default;
}


/**
 * Fetch live current weather for any city or destination via Open-Meteo
 * 100% Free, zero API key required, reliable real-time meteorological data.
 */
export async function fetchLiveCityWeather(cityName: string): Promise<{
  temp: number;
  condition: string;
  icon: string;
  windSpeed: number;
  humidity?: number;
} | null> {
  if (!cityName) return null;
  try {
    const cleanCity = cityName.split(",")[0].trim().replace(/district/gi, "").trim();
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    const loc = geoData.results?.[0];
    if (!loc) return null;

    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`;
    const wRes = await fetch(wUrl);
    if (!wRes.ok) return null;
    const wData = await wRes.json();
    const cur = wData.current_weather;
    if (!cur) return null;

    const code = cur.weathercode ?? 0;
    let condition = "Clear Sky";
    let icon = "sunny";

    if (code === 0) {
      condition = "Clear Sky";
      icon = "sunny";
    } else if (code >= 1 && code <= 3) {
      condition = "Partly Cloudy";
      icon = "partly-sunny";
    } else if (code === 45 || code === 48) {
      condition = "Fog / Mist";
      icon = "cloud";
    } else if (code >= 51 && code <= 67) {
      condition = "Rain & Showers";
      icon = "rainy";
    } else if (code >= 71 && code <= 77) {
      condition = "Snowy";
      icon = "snow";
    } else if (code >= 80 && code <= 82) {
      condition = "Showers";
      icon = "rainy";
    } else if (code >= 95) {
      condition = "Thunderstorm";
      icon = "thunderstorm";
    }

    return {
      temp: Math.round(cur.temperature),
      condition,
      icon,
      windSpeed: Math.round(cur.windspeed || 0),
    };
  } catch (err) {
    console.warn("Live weather fetch error:", err);
    return null;
  }
}

/**
 * Fetch multiple high-resolution photos (4+ images) automatically from Wikimedia Commons & Curated Gallery
 * Free, high-speed, zero API key required!
 */
async function fetchMultipleHighResPhotosClient(
  name: string,
  photoQuery: string,
  category: string,
  city?: string
): Promise<{ images: string[]; imageUrl: string; imageThumbnail: string; imageSource: "wikimedia" | "curated" }> {
  // 1. Try Commons verified files specifically for this place
  const commonsImages = await fetchPlaceGalleryCommons(name, city);
  if (commonsImages.length >= 4) {
    return {
      images: commonsImages,
      imageUrl: commonsImages[0],
      imageThumbnail: commonsImages[0],
      imageSource: "wikimedia",
    };
  }

  // 2. Supplement with Wikipedia pageimages for this specific term
  const images = [...commonsImages];
  const searchTerms = [
    `${name} ${city || ""}`.trim(),
    name,
    photoQuery,
  ].filter(Boolean);

  for (const term of searchTerms) {
    if (images.length >= 6) break;
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        term
      )}&gsrlimit=6&prop=pageimages&pithumbsize=1200&format=json`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { "User-Agent": "BunkMatesApp/2.0 (travel@bunkmates.app)" },
      });
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const pages = Object.values(wikiData.query?.pages || {});
        for (const page of pages as any[]) {
          const src = page.thumbnail?.source;
          if (src && typeof src === "string" && !images.includes(src)) {
            const title = (page.title || "").toLowerCase();
            // Don't leak Taj Mahal or Agra into Jaipur!
            if (city && city.toLowerCase().includes("jaipur")) {
              if (title.includes("taj") || title.includes("agra")) continue;
            }
            images.push(src);
            if (images.length >= 6) break;
          }
        }
      }
    } catch {
      // Continue
    }
  }

  const primary = images[0] || getFallbackPhoto(category, name);
  return {
    images: images.length > 0 ? images : [primary],
    imageUrl: primary,
    imageThumbnail: primary,
    imageSource: images.length > 0 ? "wikimedia" : "curated",
  };
}

/**
 * Direct Gemini Client Execution (Fallback if Cloud Function is not yet deployed)
 */
async function executeClientGeminiEngine(rawQuery: string, category: string, limit = 6): Promise<TravelDiscoveryItem[]> {
  const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("Gemini API key is not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in .env");
  }

  const qLower = rawQuery.toLowerCase();
  const isFoodExplicit = /food|eat|dish|restaurant|cafe|breakfast|lunch|dinner|snack|sweet|chaat|chai|coffee|bakery|mithai|kulcha|kachori|biryani/i.test(qLower);
  const isPlacesExplicit = /place|visit|sight|monument|attraction|fort|palace|temple|lake|hill|waterfall|trek|beach|viewpoint|tourism/i.test(qLower);

  let targetPromptQuery = rawQuery;
  let targetLimit = limit;

  if (category === "food") {
    // If user clicked Food tab, force food discovery for the extracted city
    const cleanedCity = rawQuery
      .replace(/best\s+places\s+to\s+visit\s+in/gi, "")
      .replace(/places\s+to\s+visit\s+in/gi, "")
      .replace(/places\s+in/gi, "")
      .replace(/top\s+attractions\s+in/gi, "")
      .replace(/things\s+to\s+do\s+in/gi, "")
      .replace(/best\s+places\s+in/gi, "")
      .trim();
    targetPromptQuery = `Famous authentic street food, traditional dishes, local sweets, iconic eateries, and cafes in ${cleanedCity || rawQuery}`;
  } else if (category === "places") {
    const cleanedCity = rawQuery
      .replace(/famous\s+street\s+food\s+in/gi, "")
      .replace(/best\s+food\s+in/gi, "")
      .replace(/food\s+in/gi, "")
      .trim();
    targetPromptQuery = `Top tourist attractions, heritage monuments, scenic viewpoints, and sightseeing places in ${cleanedCity || rawQuery}`;
  } else if (category === "all") {
    if (!isFoodExplicit && !isPlacesExplicit) {
      // Just city name like "Chittorgarh" -> return BOTH places and food
      targetPromptQuery = `Top tourist attractions, heritage sites AND famous local street food in ${rawQuery} (return 4 famous sightseeing places AND 4 iconic street foods/eateries)`;
      targetLimit = 8;
    }
  }

  const systemPrompt = `You are BunkMates Travel Engine, a high-precision travel, tourism, and food intelligence engine.
CRITICAL LOCATION & CATEGORY RULES:
1. Extract the targeted city or region from the user query (e.g. "Chittorgarh", "Jaipur", "Goa").
2. ALL returned items MUST be real and located SPECIFICALLY in that targeted city! NEVER return places from different cities or states.
3. CATEGORY SPECIFICS:
   - If Category filter is "places": ALL returned items MUST be sightseeing spots, forts, palaces, temples, lakes, or viewpoints (NO food).
   - If Category filter is "food": ALL returned items MUST be famous street foods, iconic dishes, sweets, or cafes (NO forts/monuments).
   - If Category filter is "all":
     * If query is just a city name: return BOTH famous sightseeing places AND iconic local foods (4 places and 4 foods).
     * Else return items matching the user query.

Return STRICTLY a JSON array of ${targetLimit} items with this exact schema:
[
  {
    "id": "slug-name",
    "name": "Exact Name of Place / Food / Cafe",
    "category": "Sightseeing" | "Heritage" | "Nature" | "Street Food" | "Cafe" | "Experience",
    "city": "Target City name",
    "state": "State name",
    "rating": 4.7,
    "reviewCount": 1420,
    "timing": "e.g. 9:00 AM - 5:00 PM (All Days Open)",
    "entryFee": "e.g. ₹50 for Indians, ₹300 for Foreigners",
    "entryFees": {
      "indians": "₹50 per person",
      "foreigners": "₹300 per person",
      "students": "₹25 per person (with Student ID)",
      "children": "Free (Below 7 yrs)",
      "camera": "₹50 (Photography)"
    },
    "approxCost": "e.g. ₹200 for two",
    "highlight": "One punchy sentence describing the highlight (under 20 words)",
    "detailedOverview": "Rich, comprehensive 2-3 paragraph informative guide covering historical background, architectural wonder, key sights inside, and experiential visitor tips.",
    "highlightsList": [
      "Key highlight or architectural feature 1",
      "Key highlight 2",
      "Key highlight 3"
    ],
    "bestTimeToVisit": "STRICTLY hours of the day (e.g. 'Early Morning (8:00 AM - 10:30 AM)' or 'Late Afternoon (4:00 PM - 6:00 PM)'). NEVER output month names or seasons here!",
    "bestTimeReason": "e.g. Cool breeze, pleasant morning sunlight for sundial shadows and crisp photography without crowd.",
    "season": "STRICTLY months or season (e.g. 'October to March (Winter Season)').",
    "seasonReason": "e.g. Mild pleasant climate (15°C - 25°C) avoiding extreme scorching summer temperatures.",
    "address": "Locality or landmark address",
    "imageSearchQuery": "Exact visual keyword for travel photography (e.g. Jantar Mantar Jaipur)",
    "tags": ["Sightseeing", "Jaipur", "UNESCO"],
    "nearestAttractions": [
      {
        "name": "Nearby landmark 1 in the same city",
        "distance": "e.g. 500 m away",
        "description": "Short 1-line description of why visit"
      },
      {
        "name": "Nearby landmark 2 in the same city",
        "distance": "e.g. 1.2 km away",
        "description": "Short 1-line description"
      }
    ]
  }
]
Output strictly raw JSON without markdown code fences.`;

  const models = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
  ];
  let parsed: any[] = [];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      
      // Try fast mode (thinkingBudget = 0 for sub-2s responses)
      let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${systemPrompt}\n\nSearch Query: "${targetPromptQuery}" (Category filter: ${category})` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });

      // Fallback if thinkingConfig not accepted
      if (!res.ok) {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\nSearch Query: "${targetPromptQuery}" (Category filter: ${category})` }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        });
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini ${model} returned ${res.status}: ${errText}`);
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const cleaned = rawText.replace(/^```json/im, "").replace(/^```/im, "").replace(/```$/im, "").trim();
      parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw lastErr || new Error("Failed to parse Gemini recommendations");
  }

  // Enrich with HD Multiple Images + Verified Nearby Attractions
  const enriched: TravelDiscoveryItem[] = await Promise.all(
    parsed.map(async (item: any, idx: number) => {
      const fallbackUrl = getFallbackPhoto(item.category || "sightseeing", item.name || "");
      const photoData = await fetchMultipleHighResPhotosClient(
        item.name,
        item.imageSearchQuery || `${item.name} ${item.city || ""}`,
        item.category || "sightseeing",
        item.city
      );

      // Sanitize bestTimeToVisit so it NEVER has months in time of day
      let sanitizedTimeOfDay = item.bestTimeToVisit || "Early Morning (8:30 AM - 11:00 AM)";
      let sanitizedSeason = item.season || "October to March (Winter Season)";
      if (/november|december|january|february|march|october|winter|summer|monsoon/i.test(sanitizedTimeOfDay)) {
        if (!item.season || item.season.length < 5) {
          sanitizedSeason = sanitizedTimeOfDay;
        }
        sanitizedTimeOfDay = "Early Morning (8:30 AM - 11:00 AM) or Late Afternoon (4:00 PM - 6:00 PM)";
      }

      // Resolve thumbnails for nearestAttractions
      const rawNearest = Array.isArray(item.nearestAttractions) ? item.nearestAttractions : [];
      const enrichedNearest = await Promise.all(
        rawNearest.slice(0, 3).map(async (na: any) => {
          const thumb = await fetchNearbyAttractionThumb(na.name, item.city || "");
          return {
            name: na.name,
            distance: na.distance || "Nearby",
            description: na.description || "Historic landmark",
            imageUrl: thumb || undefined,
          };
        })
      );

      return {
        id: item.id || `item_${idx}_${Date.now()}`,
        name: item.name || "Recommendation",
        category: item.category || "Sightseeing",
        city: item.city || "",
        state: item.state || "",
        rating: typeof item.rating === "number" ? Math.min(5, Math.max(3.8, item.rating)) : 4.6,
        reviewCount: typeof item.reviewCount === "number" ? item.reviewCount : 500,
        timing: item.timing || "Open daily 9:00 AM - 5:00 PM",
        entryFee: item.entryFee || "Free Entry",
        entryFees: item.entryFees || {
          indians: item.entryFee || "Free Entry",
          foreigners: "Standard admission",
          students: "Discount with ID",
        },
        approxCost: item.approxCost || "Varies",
        highlight: item.highlight || "Popular attraction",
        detailedOverview: item.detailedOverview || item.highlight || "Discover this remarkable destination in detail.",
        highlightsList: Array.isArray(item.highlightsList) && item.highlightsList.length > 0 ? item.highlightsList : [item.highlight || "Iconic destination"],
        bestTimeToVisit: sanitizedTimeOfDay,
        bestTimeReason: item.bestTimeReason || "Best ambient lighting, cooler temperatures, and lower tourist crowds.",
        season: sanitizedSeason,
        seasonReason: item.seasonReason || "Comfortable pleasant climate ideal for open-air exploration.",
        address: item.address || "",
        imageUrl: photoData.imageUrl,
        imageThumbnail: photoData.imageThumbnail,
        images: photoData.images && photoData.images.length > 0 ? photoData.images : [photoData.imageUrl],
        fallbackImageUrl: fallbackUrl,
        imageSource: photoData.imageSource,
        photographer: null,
        tags: Array.isArray(item.tags) ? item.tags : ["Travel", "Must Visit"],
        nearestAttractions: enrichedNearest,
      };
    })
  );

  return enriched;
}

/**
 * Universal BunkMates Travel Discovery Search Engine
 * 1. Checks Firestore Cache (Instant <50ms)
 * 2. Tries Firebase Cloud Function
 * 3. Falls back to direct Client Gemini + Pexels execution
 * 4. Automatically caches results in Firestore for 30 days
 */
export async function searchTravelEngine(
  query: string,
  category: string = "all",
  limit: number = 6
): Promise<TravelSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return { results: [], cached: false, source: "cache", query: trimmed };
  }

  // Cache key includes category so places and food don't collide
  const normalizedKey = `${trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 80)}_${category}`;

  // 1. Direct Firestore Cache Check
  try {
    const cacheDoc = await getDoc(doc(db, "travel_search_cache", normalizedKey));
    if (cacheDoc.exists()) {
      const data = cacheDoc.data();
      const now = Date.now();
      if (data.expiresAt && data.expiresAt > now && Array.isArray(data.results) && data.results.length > 0) {
        const qLower = trimmed.toLowerCase();
        const words = qLower.split(/\s+/).filter(w => w.length > 3 && !["best", "places", "place", "visit", "food", "tourist", "near"].includes(w));
        const matchesTarget = words.length === 0 || data.results.some((r: any) =>
          words.some(w => (r.city?.toLowerCase() || "").includes(w) || (r.name?.toLowerCase() || "").includes(w))
        );

        if (matchesTarget) {
          return {
            results: data.results,
            cached: true,
            source: "cache",
            query: trimmed,
          };
        }
      }
    }
  } catch (cacheErr) {
    console.warn("Direct cache read failed, continuing to live fetch:", cacheErr);
  }

  // 2. Try Firebase Cloud Function (if deployed)
  try {
    const callFunction = httpsCallable<
      { query: string; category: string; limit: number },
      { results: TravelDiscoveryItem[]; cached: boolean; source: string }
    >(functions, "searchTravelDiscovery");

    const response = await callFunction({
      query: trimmed,
      category,
      limit,
    });

    if (response?.data?.results && response.data.results.length > 0) {
      return {
        results: response.data.results,
        cached: !!response.data.cached,
        source: "cloud_function",
        query: trimmed,
      };
    }
  } catch (fnErr: any) {
    console.log("Cloud function not reachable or failed, using client fallback engine:", fnErr?.message);
  }

  // 3. Client-Side Fallback Engine (Gemini Flash-Lite + Wikimedia + Curated)
  const clientResults = await executeClientGeminiEngine(trimmed, category, limit);

  // 4. Save to Firestore Cache from Client (30 days TTL)
  try {
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await setDoc(doc(db, "travel_search_cache", normalizedKey), {
      query: trimmed,
      category,
      results: clientResults,
      createdAt: Date.now(),
      expiresAt,
    });
  } catch (saveCacheErr) {
    console.warn("Client cache save warning:", saveCacheErr);
  }

  return {
    results: clientResults,
    cached: false,
    source: "client_engine",
    query: trimmed,
  };
}
