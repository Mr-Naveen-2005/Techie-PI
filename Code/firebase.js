# Emergency SOS App — MVP Prototype

A working first prototype built from your architecture diagram, hand-drawn wireframe, and Techie Pi pitch deck.

## What's here

```
sos-app/
├── frontend/
│   └── index.html          ← self-contained prototype (open directly in a browser)
└── backend/
    ├── server.js            ← Express API
    ├── integrations/
    │   ├── twilio.js         ← WhatsApp alerts to family
    │   ├── googleMaps.js     ← maps link + reverse geocoding
    │   ├── googleTTS.js      ← voice announcement script/audio
    │   └── firebase.js       ← Realtime DB (REST API, live location)
    ├── package.json
    └── .env.example
```

## How it maps to your flow

| Wireframe step | Where it lives |
|---|---|
| 1. Tap SOS | `frontend/index.html` — big pulsing SOS button |
| 2. Enter PIN | PIN keypad screen → `POST /api/sos/verify-pin` |
| 3. Choose Crime / Health | Category screen |
| 4/5. Auto-detect within 10s + contact Police/Hospital, send location, message, audio call | Countdown ring screen → `POST /api/sos/trigger`, which fans out to WhatsApp (Twilio), TTS announcement (Google), and dispatch, all in parallel |
| 6. Live location & medical details if Health | Dispatch screen with 3-minute live-tracking badge → `POST /api/sos/:id/location` |

This also follows the architecture diagram exactly: **Frontend → Device APIs → (Phone Dialer / Google TTS / Twilio WhatsApp) → Google Maps API → Firebase Realtime DB.**

## Running it

**Frontend** — no build step needed:
```bash
open frontend/index.html
# or serve it: npx serve frontend
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env   # optional — works without any keys, in simulation mode
npm start
```

The backend runs fully in **simulation mode** with zero API keys — every WhatsApp send, TTS call, and Firebase write is console-logged instead of firing for real, so you can demo the complete flow immediately. Fill in `.env` with real Twilio / Google Maps / Google TTS / Firebase credentials whenever you're ready to go live — no code changes needed, each integration file auto-detects whether credentials are present.

## What's stubbed vs. real in this MVP

- **Real:** Express API, request routing, incident data model, geolocation capture (browser `navigator.geolocation`), Maps deep link generation, PIN entry UI, full screen flow matching your wireframe.
- **Stubbed (swap in real keys via `.env`):** actual WhatsApp delivery, actual voice synthesis audio, actual Firebase persistence, actual police/ambulance dispatch API (there isn't a public one — in production this is typically a call via the phone dialer intent on native mobile, which only works in React Native/native, not a browser).

## Suggested next steps toward the React Native version

1. Port `frontend/index.html`'s screens into React Native components — the state machine (PIN → category → countdown → dispatch) transfers directly.
2. Replace `navigator.geolocation` with `expo-location` (or `@react-native-community/geolocation`).
3. Replace the simulated "Police dispatch" with `Linking.openURL('tel:100')` (native dialer, per your architecture diagram).
4. Add `expo-local-authentication` if you want fingerprint unlock alongside the PIN, per the architecture diagram's "Fingerprint" device API.
5. Move the PIN check server-side only (never trust a client-side match) and hash it with bcrypt.
