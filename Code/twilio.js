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
  await fetch(url, { method: 'PUT', body: JSON.stringify(incident) });
}

async function pushLiveLocation(incidentId, coords) {
  const entry = { ...coords, ts: Date.now() };
  memoryStore.liveLocations[incidentId] = memoryStore.liveLocations[incidentId] || [];
  memoryStore.liveLocations[incidentId].push(entry);

  if (!hasFirebase()) {
    console.log(`[SIMULATED Firebase] live location for ${incidentId}:`, entry);
    return;
  }
  const url = `${process.env.FIREBASE_DB_URL}/liveLocations/${incidentId}.json?auth=${process.env.FIREBASE_DB_SECRET || ''}`;
  await fetch(url, { method: 'POST', body: JSON.stringify(entry) });
}

module.exports = { saveIncident, pushLiveLocation, memoryStore };
