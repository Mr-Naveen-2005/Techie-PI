/**
 * Google Maps integration.
 * Set GOOGLE_MAPS_API_KEY in .env to enable real reverse geocoding.
 * The maps link works with no key at all (standard Google Maps URL scheme).
 * Added caching for reverse geocoding to reduce API calls.
 */

// Simple cache for reverse geocoding results (expires after 1 hour)
const geocodeCache = new Map();
const GEOCODE_CACHE_TTL = 3600000; // 1 hour in milliseconds

function cleanCache() {
  const now = Date.now();
  for (const [key, { timestamp }] of geocodeCache.entries()) {
    if (now - timestamp > GEOCODE_CACHE_TTL) {
      geocodeCache.delete(key);
    }
  }
}

// Clean cache every 5 minutes
setInterval(cleanCache, 300000);

function buildMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function reverseGeocode(lat, lng) {
  // Create a cache key from rounded coordinates (to group nearby locations)
  const latKey = Math.round(lat * 1000) / 1000; // 3 decimal places = ~1m precision
  const lngKey = Math.round(lng * 1000) / 1000;
  const cacheKey = `${latKey},${lngKey}`;

  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
    return cached.value;
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    const result = `Approx. ${lat.toFixed(4)}, ${lng.toFixed(4)} (set GOOGLE_MAPS_API_KEY for a real address)`;
    geocodeCache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Geocoding API error: ${res.status}`);
    }

    const data = await res.json();
    let result = `${lat}, ${lng}`; // fallback to coordinates

    if (data.results && data.results.length > 0) {
      result = data.results[0].formatted_address;
    }

    // Cache the result
    geocodeCache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('Geocoding request timed out, using coordinates');
      const result = `Approx. ${lat.toFixed(4)}, ${lng.toFixed(4)} (timeout)`;
      geocodeCache.set(cacheKey, { value: result, timestamp: Date.now() });
      return result;
    }
    console.warn('reverseGeocode failed, falling back to coordinates:', err.message);
    const result = `Approx. ${lat.toFixed(4)}, ${lng.toFixed(4)} (error)`;
    geocodeCache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
  }
}

module.exports = { buildMapsLink, reverseGeocode };