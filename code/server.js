/**
 * SOS App — Backend Prototype
 * Node.js + Express
 *
 * Matches the architecture diagram:
 *   Frontend -> Device APIs -> [Phone Dialer | Vonage SMS] -> Google Maps API -> Firebase Realtime DB
 *
 * Optimized version with improved API efficiency:
 * - Added timeouts for external API calls
 * - Better error handling and fallback mechanisms
 * - Optimized geocoding with caching
 * - Non-blocking operations where possible
 * - Removed TTS feature as requested
 */

/* ---------------------------------------------------------------------- */
/* Imports                                                                  */
/* ---------------------------------------------------------------------- */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { sendSMS } = require('./integrations/sms');
const { buildMapsLink, reverseGeocode } = require('./integrations/googleMaps');
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
/* Helper Functions with Timeouts                                           */
/* ---------------------------------------------------------------------- */

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Error message if timeout occurs
 * @returns {Promise}
 */
function withTimeout(promise, ms, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
}

/* ---------------------------------------------------------------------- */
/* Routes                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Step: Enter PIN (per wireframe step 2)
 */
app.post('/api/sos/verify-pin', (req, res) => {
  const { userId, pin } = req.body;
  const user = users[userId];
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  const ok = user.pinHash === pin;
  res.json({ ok });
});

/**
 * Step: SOS triggered — category + location known (per wireframe steps 3-5)
 * OPTIMIZED VERSION WITH TTS REMOVED
 */
app.post('/api/sos/trigger', async (req, res) => {
  const { category, type, location, userId } = req.body;
  if (!category || !location) {
    return res.status(400).json({ ok: false, error: 'category and location are required' });
  }

  const user = users[userId] || { name: 'Unknown User', emergencyContacts: [] };
  const incidentId = uuidv4();

  try {
    // Step 1: Get map link (synchronous, no API call)
    const mapsLink = buildMapsLink(location.lat, location.lng);

    // Step 2: Get address with timeout and caching (handled in reverseGeocode)
    const address = await withTimeout(
      reverseGeocode(location.lat, location.lng),
      8000,
      'Geocoding timeout'
    );

    // Step 3: Prepare incident object
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

    // Step 4: Prepare message for notifications
    const message =
      `🚨 SOS Alert from ${user.name}\n` +
      `Type: ${category.toUpperCase()} — ${incident.type}\n` +
      `Location: ${address || 'Unknown'}\n` +
      `Map: ${mapsLink}\n` +
      (user.medicalNotes ? `Medical notes: ${user.medicalNotes}\n` : '') +
      `Sent automatically by SOS App.`;

    // Step 5: Fire all notifications in parallel with individual timeouts
    const notificationPromises = [
      // SMS to all emergency contacts
      ...user.emergencyContacts.map(c =>
        withTimeout(
          sendSMS(c.phone, message),
          10000,
          `SMS to ${c.name} (${c.phone}) timeout`
        )
      ),

      // Dispatch simulation (instant, but wrapped for consistency)
      Promise.resolve({
        dispatched: category === 'crime' ? 'Police (100)' : 'Ambulance / Nearest Hospital'
      })
    ];

    // Wait for all notifications to complete (or timeout)
    const results = await Promise.allSettled(notificationPromises);

    // Step 6: Process results
    incident.channels = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Determine which service failed based on index
        const smsCount = user.emergencyContacts.length;
        if (index < smsCount) {
          const contactIndex = index;
          const contact = user.emergencyContacts[contactIndex];
          return {
            channel: 'sms',
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
            to: contact.phone,
            contact: contact.name
          };
        } else {
          // This is the dispatch service (always at index = smsCount)
          return {
            channel: 'dispatch',
            status: 'failed',
            error: result.reason?.message || 'Unknown error'
          };
        }
      }
    });

    // Step 7: Store incident (non-blocking for response)
    incidents[incidentId] = incident;

    // Fire-and-forget Firebase save (don't wait for it in response)
    saveIncident(incident).catch(err => {
      console.warn('Failed to save incident to Firebase:', err.message);
    });

    // Step 8: Respond quickly to client
    res.json({
      ok: true,
      incidentId,
      mapsLink,
      address,
      channels: incident.channels
    });

  } catch (error) {
    // Handle timeouts or other errors from awaited promises
    console.error('Error in SOS trigger:', error.message);
    res.status(500).json({
      ok: false,
      error: 'Failed to process SOS request: ' + error.message
    });
  }
});

/**
 * Step 6: Live location tracking — device pushes updates every ~10-30s for 3 minutes
 */
app.post('/api/sos/:id/location', (req, res) => {
  const incident = incidents[req.params.id];
  if (!incident) return res.status(404).json({ ok: false, error: 'Incident not found' });
  const { lat, lng } = req.body;
  incident.liveLocationHistory.push({ lat, lng, ts: new Date().toISOString() });
  pushLiveLocation(incident.id, { lat, lng }); // Firebase Realtime DB stub
  res.json({ ok: true });
});

/**
 * Poll current status of an incident (used by a family/responder view)
 */
app.get('/api/sos/:id', (req, res) => {
  const incident = incidents[req.params.id];
  if (!incident) return res.status(404).json({ ok: false, error: 'Incident not found' });
  res.json({ ok: true, incident });
});

/**
 * Mark incident resolved (stop live tracking)
 */
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