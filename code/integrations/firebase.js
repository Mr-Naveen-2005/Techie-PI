/**
 * Firebase Realtime Database integration — accessed via its REST API
 * (no firebase-admin SDK needed, just fetch + a database secret/URL).
 *
 * Set FIREBASE_DB_URL (e.g. https://your-project.firebaseio.com) and
 * FIREBASE_DB_SECRET in .env to persist for real. Without them, this
 * keeps everything in memory so the demo still runs end-to-end.
 */

const memoryStore = { incidents: {}, liveLocations: {} };

function hasFirebase() {
  return !!process.env.FIREBASE_DB_URL;
}

async function saveIncident(incident) {
  memoryStore.incidents[incident.id] = incident;
  if (!hasFirebase()) {
    console.log(`[SIMULATED Firebase] saved incident ${incident.id}`);
    return;
  }
  const url = `${process.env.FIREBASE_DB_URL}/incidents/${incident.id}.json?auth=${process.env.FIREBASE_DB_SECRET || ''}`;
  try {
    await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(incident),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`Failed to save incident ${incident.id} to Firebase:`, err.message);
    // Still keep in memory store as fallback
  }
}

async function pushLiveLocation(incidentId, coords) {
  const entry = { ...coords, ts: Date.now() };
  memoryStore.liveLocations[incidentId] = memoryStore.liveLocations[incidentId] || [];
  memoryStore.liveLocations[incidentId].push(entry);

  // Keep only last 50 locations to prevent unlimited growth
  if (memoryStore.liveLocations[incidentId].length > 50) {
    memoryStore.liveLocations[incidentId] = memoryStore.liveLocations[incidentId].slice(-50);
  }

  if (!hasFirebase()) {
    console.log(`[SIMULATED Firebase] live location for ${incidentId}:`, entry);
    return;
  }
  const url = `${process.env.FIREBASE_DB_URL}/liveLocations/${incidentId}.json?auth=${process.env.FIREBASE_DB_SECRET || ''}`;
  try {
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify(entry),
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`Failed to push live location for ${incidentId} to Firebase:`, err.message);
    // Still keep in memory store as fallback
  }
}

/**
 * Get incident data from Firebase (useful for recovery or sync)
 */
async function getIncident(incidentId) {
  if (!hasFirebase()) {
    return memoryStore.incidents[incidentId] || null;
  }
  const url = `${process.env.FIREBASE_DB_URL}/incidents/${incidentId}.json?auth=${process.env.FIREBASE_DB_SECRET || ''}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`Failed to get incident ${incidentId} from Firebase:`, err.message);
    return memoryStore.incidents[incidentId] || null;
  }
}

/**
 * Get recent location history for an incident
 */
async function getLocationHistory(incidentId, limit = 50) {
  if (!hasFirebase()) {
    const history = memoryStore.liveLocations[incidentId] || [];
    return history.slice(-limit);
  }
  const url = `${process.env.FIREBASE_DB_URL}/liveLocations/${incidentId}.json?auth=${process.env.FIREBASE_DB_SECRET || ''}&orderBy="$key"&limitToLast=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data && typeof data === 'object') {
      return Object.values(data);
    }
    return [];
  } catch (err) {
    console.error(`Failed to get location history for ${incidentId} from Firebase:`, err.message);
    return memoryStore.liveLocations[incidentId] || [];
  }
}

module.exports = {
  saveIncident,
  pushLiveLocation,
  getIncident,
  getLocationHistory,
  memoryStore
};