/**
 * SOS App — Backend Prototype
 * Node.js + Express
 *
 * Matches the architecture diagram:
 *   Frontend -> Device APIs -> [Phone Dialer | Google TTS | Twilio WhatsApp] -> Google Maps API -> Firebase Realtime DB
 *
 * This is a runnable MVP. Every external integration (Twilio, Google Maps,
 * Google TTS, Firebase) is wired through a thin wrapper in /integrations
 * that falls back to a console-logged simulation when no API key is set,
 * so you can demo the full flow before plugging in real credentials.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { sendWhatsAppAlert } = require('./integrations/twilio');
const { buildMapsLink, reverseGeocode } = require('./integrations/googleMaps');
const { announceViaTTS } = require('./integrations/googleTTS');
const { pushLiveLocation, saveIncident } = require('./integrations/firebase');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

/* ---------------------------------------------------------------------- */
/* In-memory "DB" (swap for Firebase Realtime DB / Firestore in production) */
/* ---------------------------------------------------------------------- */
const users = {
  'demo-user-001': {
    name: 'Ranjith Kumar',
    pinHash: '1234', // DEMO ONLY — hash + salt this in production (bcrypt)
    bloodGroup: 'O+',
    medicalNotes: 'No known allergies',
    emergencyContacts: [
      { name: 'Mom', phone: '+919999999901' },
      { name: 'Dad', phone: '+919999999902' },
    ],
  },
};

const incidents = {}; // incidentId -> { ...incident, liveLocationHistory: [] }

/* ---------------------------------------------------------------------- */
/* Routes                                                                  */
/* ---------------------------------------------------------------------- */

// Step: Enter PIN (per wireframe step 2)
app.post('/api/sos/verify-pin', (req, res) => {
  const { userId, pin } = req.body;
  const user = users[userId];
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  const ok = user.pinHash === pin;
  res.json({ ok });
});

// Step: SOS triggered — category + location known (per wireframe steps 3-5)
app.post('/api/sos/trigger', async (req, res) => {
  const { category, type, location, userId } = req.body;
  if (!category || !location) {
    return res.status(400).json({ ok: false, error: 'category and location are required' });
  }

  const user = users[userId] || { name: 'Unknown User', emergencyContacts: [] };
  const incidentId = uuidv4();
  const mapsLink = buildMapsLink(location.lat, location.lng);
  const address = await reverseGeocode(location.lat, location.lng);

  const incident = {
    id: incidentId,
    userId,
    userName: user.name,
    category,        // 'crime' | 'health'
    type: type || 'Auto-detected',
    location,
    address,
    mapsLink,
    createdAt: new Date().toISOString(),
    status: 'dispatched',
    channels: [],
    liveLocationHistory: [location],
  };

  const message =
    `🚨 SOS Alert from ${user.name}\n` +
    `Type: ${category.toUpperCase()} — ${incident.type}\n` +
    `Location: ${address || 'Unknown'}\n` +
    `Map: ${mapsLink}\n` +
    (user.medicalNotes ? `Medical notes: ${user.medicalNotes}\n` : '') +
    `Sent automatically by SOS App.`;

  // Fan out to all three channels in parallel (per architecture diagram)
  const results = await Promise.allSettled([
    // 1. Family via WhatsApp (Twilio)
    ...user.emergencyContacts.map(c => sendWhatsAppAlert(c.phone, message)),
    // 2. Voice announcement (Google TTS) — simulates the "state name + location" call
    announceViaTTS(`Emergency alert. ${user.name} needs help. Category ${category}. Location ${address || 'unavailable'}.`),
    // 3. Police / Hospital dispatch — in production this would call a real dispatch API;
    //    here we log the equivalent of "opening the dialer to 100 / nearest hospital"
    Promise.resolve({ dispatched: category === 'crime' ? 'Police (100)' : 'Ambulance / Nearest Hospital' }),
  ]);

  incident.channels = results.map(r => (r.status === 'fulfilled' ? r.value : { error: r.reason?.message }));
  incidents[incidentId] = incident;
  saveIncident(incident); // Firebase stub

  res.json({ ok: true, incidentId, mapsLink, address, channels: incident.channels });
});

// Step 6: Live location tracking — device pushes updates every ~10-30s for 3 minutes
app.post('/api/sos/:id/location', (req, res) => {
  const incident = incidents[req.params.id];
  if (!incident) return res.status(404).json({ ok: false, error: 'Incident not found' });
  const { lat, lng } = req.body;
  incident.liveLocationHistory.push({ lat, lng, ts: new Date().toISOString() });
  pushLiveLocation(incident.id, { lat, lng }); // Firebase Realtime DB stub
  res.json({ ok: true });
});

// Poll current status of an incident (used by a family/responder view)
app.get('/api/sos/:id', (req, res) => {
  const incident = incidents[req.params.id];
  if (!incident) return res.status(404).json({ ok: false, error: 'Incident not found' });
  res.json({ ok: true, incident });
});

// Mark incident resolved (stop live tracking)
app.post('/api/sos/:id/resolve', (req, res) => {
  const incident = incidents[req.params.id];
  if (!incident) return res.status(404).json({ ok: false, error: 'Incident not found' });
  incident.status = 'resolved';
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'sos-backend', time: Date.now() }));

app.listen(PORT, () => {
  console.log(`🚨 SOS backend prototype running on http://localhost:${PORT}`);
  console.log(`   Try: POST http://localhost:${PORT}/api/sos/trigger`);
});
