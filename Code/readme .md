Emergency SOS App

A working first prototype built from your architecture diagram, hand-drawn wireframe, and Techie Pi pitch deck.



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
