/**
 * Google Text-to-Speech integration.
 * Set GOOGLE_TTS_API_KEY in .env to synthesize real audio (returns base64 MP3).
 * In this prototype we log the script that would be spoken to the responder/police call.
 */

async function announceViaTTS(script) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) {
    console.log(`[SIMULATED TTS ANNOUNCEMENT]: "${script}"`);
    return { channel: 'tts', status: 'simulated', script };
  }

  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: script },
      voice: { languageCode: 'en-IN', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });
  const data = await res.json();
  return { channel: 'tts', status: 'synthesized', audioContentBase64: data.audioContent };
}

module.exports = { announceViaTTS };
