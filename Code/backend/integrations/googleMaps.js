/**
 * Google Maps integration.
 * Set GOOGLE_MAPS_API_KEY in .env to enable real reverse geocoding.
 * The maps link works with no key at all (standard Google Maps URL scheme).
 */

function buildMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

async function reverseGeocode(lat, lng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return `Approx. ${lat.toFixed(4)}, ${lng.toFixed(4)} (set GOOGLE_MAPS_API_KEY for a real address)`;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.results?.[0]?.formatted_address || `${lat}, ${lng}`;
  } catch (err) {
    console.warn('reverseGeocode failed, falling back to coordinates:', err.message);
    return `${lat}, ${lng}`;
  }
}

module.exports = { buildMapsLink, reverseGeocode };
