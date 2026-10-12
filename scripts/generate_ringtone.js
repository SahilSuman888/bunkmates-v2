const fs = require('fs');
const path = require('path');

// Generate an Instagram/FaceTime style chime marimba ringtone as 44.1kHz 16-bit stereo WAV
function generateRingtoneWav() {
  const sampleRate = 44100;
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  // Instagram-style melody definition: (freq, startTime, duration, volume)
  // Key of E Major: E5, G#5, B5, E6, D#6, B5, G#5, F#5 ... followed by warm chime
  const notes = [
    // Phrase 1 (Upward playful arpeggio)
    { freq: 659.25, start: 0.00, dur: 0.28, vol: 0.70 }, // E5
    { freq: 830.61, start: 0.20, dur: 0.28, vol: 0.75 }, // G#5
    { freq: 987.77, start: 0.40, dur: 0.28, vol: 0.80 }, // B5
    { freq: 1318.51, start: 0.60, dur: 0.40, vol: 0.90 }, // E6
    { freq: 1244.51, start: 0.90, dur: 0.35, vol: 0.85 }, // D#6
    { freq: 987.77, start: 1.15, dur: 0.30, vol: 0.75 }, // B5
    { freq: 830.61, start: 1.35, dur: 0.35, vol: 0.75 }, // G#5
    { freq: 739.99, start: 1.60, dur: 0.45, vol: 0.70 }, // F#5

    // Phrase 2 (Resolving melodic bloom)
    { freq: 659.25, start: 2.10, dur: 0.35, vol: 0.75 }, // E5
    { freq: 987.77, start: 2.35, dur: 0.35, vol: 0.80 }, // B5
    { freq: 1318.51, start: 2.60, dur: 0.85, vol: 0.95 }, // E6
    { freq: 1661.22, start: 2.65, dur: 0.80, vol: 0.65 }, // G#6 chime overtone
  ];

  const totalDuration = 3.6; // 3.6 seconds per loop cycle
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const dataSize = totalSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // Bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Synthesize samples
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.start + note.dur) {
        const noteT = t - note.start;
        // Marimba / Bell Envelope: fast attack (5ms), exponential decay
        const attack = Math.min(1.0, noteT / 0.006);
        const decay = Math.exp(-noteT * 5.5);
        const env = attack * decay * note.vol;

        // Rich tone: Fundamental + 2nd overtone (octave) + 3rd harmonic + high bell sparkle
        const fundamental = Math.sin(2 * Math.PI * note.freq * noteT);
        const h2 = 0.35 * Math.sin(2 * Math.PI * (note.freq * 2.00) * noteT);
        const h3 = 0.15 * Math.sin(2 * Math.PI * (note.freq * 3.01) * noteT);
        const h4 = 0.08 * Math.sin(2 * Math.PI * (note.freq * 4.02) * noteT);

        const tone = (fundamental + h2 + h3 + h4) * env;

        // Subtle stereo panning for spaciousness
        const pan = 0.5 + 0.2 * Math.sin(note.freq * 0.01);
        sampleL += tone * (1 - pan);
        sampleR += tone * pan;
      }
    }

    // Soft limiter / clipping protection
    sampleL = Math.max(-0.95, Math.min(0.95, sampleL));
    sampleR = Math.max(-0.95, Math.min(0.95, sampleR));

    const intL = Math.floor(sampleL * 32767);
    const intR = Math.floor(sampleR * 32767);

    const offset = 44 + i * blockAlign;
    buffer.writeInt16LE(intL, offset);
    buffer.writeInt16LE(intR, offset + 2);
  }

  return buffer;
}

// Write to android res/raw and assets/sounds
const wavBuffer = generateRingtoneWav();

const rawDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw');
if (!fs.existsSync(rawDir)) {
  fs.mkdirSync(rawDir, { recursive: true });
}
const rawPath = path.join(rawDir, 'call_ringtone.wav');
fs.writeFileSync(rawPath, wavBuffer);
console.log(`Saved Android raw ringtone: ${rawPath} (${wavBuffer.length} bytes)`);

const assetsDir = path.join(__dirname, '..', 'assets', 'sounds');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
const assetsPath = path.join(assetsDir, 'call_ringtone.wav');
fs.writeFileSync(assetsPath, wavBuffer);
console.log(`Saved Assets ringtone: ${assetsPath} (${wavBuffer.length} bytes)`);
