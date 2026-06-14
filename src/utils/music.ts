// Musical definitions and helper functions for Ear Trainer

export interface Key {
  name: string;
  tonicMidi: number; // MIDI number of the tonic in the 4th octave (e.g. C4 = 60)
}

export const KEYS: Key[] = [
  { name: 'C', tonicMidi: 60 },
  { name: 'C# / Db', tonicMidi: 61 },
  { name: 'D', tonicMidi: 62 },
  { name: 'D# / Eb', tonicMidi: 63 },
  { name: 'E', tonicMidi: 64 },
  { name: 'F', tonicMidi: 65 },
  { name: 'F# / Gb', tonicMidi: 66 },
  { name: 'G', tonicMidi: 67 },
  { name: 'G# / Ab', tonicMidi: 68 },
  { name: 'A', tonicMidi: 69 },
  { name: 'A# / Bb', tonicMidi: 70 },
  { name: 'B', tonicMidi: 71 },
];

export interface ScaleDegree {
  degree: string;      // "1", "2", "3", "4", "5", "6", "7", "#4", "b7", etc.
  solfege: string;     // "Do", "Re", "Mi", "Fa", "Sol", "La", "Ti", etc.
  semitones: number;   // semitones relative to tonic
  isDiatonic: boolean;
  color: string;       // Color coding for visual cues
}

export const SCALE_DEGREES: ScaleDegree[] = [
  { degree: '1', solfege: 'Do', semitones: 0, isDiatonic: true, color: '#3B82F6' },   // Blue (Stable)
  { degree: 'b2', solfege: 'Ra', semitones: 1, isDiatonic: false, color: '#EF4444' }, // Red (Highly unstable)
  { degree: '2', solfege: 'Re', semitones: 2, isDiatonic: true, color: '#F59E0B' },   // Amber (Passing)
  { degree: 'b3', solfege: 'Me', semitones: 3, isDiatonic: false, color: '#EC4899' }, // Pink
  { degree: '3', solfege: 'Mi', semitones: 4, isDiatonic: true, color: '#10B981' },   // Emerald (Stable)
  { degree: '4', solfege: 'Fa', semitones: 5, isDiatonic: true, color: '#8B5CF6' },   // Purple (Leaning to 3)
  { degree: '#4', solfege: 'Fi', semitones: 6, isDiatonic: false, color: '#6366F1' },  // Indigo
  { degree: 'b5', solfege: 'Se', semitones: 6, isDiatonic: false, color: '#6366F1' },  // Enharmonic spelling for #4
  { degree: '5', solfege: 'Sol', semitones: 7, isDiatonic: true, color: '#06B6D4' },  // Cyan (Stable dominant)
  { degree: '#5', solfege: 'Si', semitones: 8, isDiatonic: false, color: '#14B8A6' },  // Teal
  { degree: 'b6', solfege: 'Le', semitones: 8, isDiatonic: true, color: '#14B8A6' },   // Minor sixth
  { degree: '6', solfege: 'La', semitones: 9, isDiatonic: true, color: '#F97316' },   // Orange (Leaning to 5)
  { degree: 'b7', solfege: 'Te', semitones: 10, isDiatonic: false, color: '#F43F5E' }, // Rose
  { degree: '7', solfege: 'Ti', semitones: 11, isDiatonic: true, color: '#84CC16' },  // Lime (Leaning strongly to 1)
  { degree: '8', solfege: 'Do', semitones: 12, isDiatonic: true, color: '#3B82F6' },  // Blue (High Octave Tonic)
];

export type Difficulty = 'easy' | 'medium' | 'hard' | 'minor' | 'chromatic';

export interface DifficultyConfig {
  id: Difficulty;
  name: string;
  description: string;
  degrees: string[]; // List of scale degrees included in this level
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'easy',
    name: '骨干音训练 (Easy)',
    description: '仅包含 1, 3, 5 (Do, Mi, Sol)，建立最基础稳定的音感结构。',
    degrees: ['1', '3', '5', '8'],
  },
  {
    id: 'medium',
    name: '五声音阶 (Medium)',
    description: '包含 1, 2, 3, 5, 6 (Do, Re, Mi, Sol, La)，经典国风/流行五声音阶。',
    degrees: ['1', '2', '3', '5', '6', '8'],
  },
  {
    id: 'hard',
    name: '自然大调 (Hard)',
    description: '包含完整自然七声音阶 (1, 2, 3, 4, 5, 6, 7)。',
    degrees: ['1', '2', '3', '4', '5', '6', '7', '8'],
  },
  {
    id: 'minor',
    name: '自然小调 (Minor)',
    description: '包含 1, 2, b3, 4, 5, b6, b7，训练小调色彩和稳定感。',
    degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7', '8'],
  },
  {
    id: 'chromatic',
    name: '半音阶挑战 (Chromatic)',
    description: '包含所有半音，挑战高难度离调音听辨（如 b7, #4 ）。',
    degrees: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', '#5', '6', 'b7', '7', '8'],
  },
];

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTIES.find(d => d.id === difficulty) || DIFFICULTIES[0];
}

export function getScaleDegreeByName(degreeName: string): ScaleDegree | null {
  return SCALE_DEGREES.find(deg => deg.degree === degreeName) || null;
}

export function getScaleDegreesForDifficulty(difficulty: Difficulty): ScaleDegree[] {
  const config = getDifficultyConfig(difficulty);
  return config.degrees
    .map(getScaleDegreeByName)
    .filter((degree): degree is ScaleDegree => Boolean(degree));
}

export function getScaleDegreeForSemitones(
  semitones: number,
  preferredDegrees: string[] = []
): ScaleDegree | null {
  const normalized = ((semitones % 12) + 12) % 12;
  const exactPreferred = preferredDegrees
    .map(getScaleDegreeByName)
    .find(degree => degree && degree.semitones === semitones);

  if (exactPreferred) return exactPreferred;

  const preferred = preferredDegrees
    .map(getScaleDegreeByName)
    .find(degree => degree && degree.semitones % 12 === normalized);

  if (preferred) return preferred;

  const exact = SCALE_DEGREES.find(degree => degree.semitones === semitones);
  if (exact) return exact;

  return SCALE_DEGREES.find(degree => degree.semitones % 12 === normalized) || null;
}

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Converts a MIDI note number to its string representation (e.g. 60 -> 'C4')
 */
export function midiToNoteName(midi: number): string {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Gets the CDN URL for a MIDI note
 */
export function getNoteAudioUrl(midi: number): string {
  const noteName = midiToNoteName(midi);
  return `https://cdn.jsdelivr.net/gh/fuhton/piano-mp3@master/piano-mp3/${noteName}.mp3`;
}

/**
 * Returns the cadence chord notes for a given tonic MIDI.
 * Standard I - IV - V - I progression.
 * We build the notes in a comfortable range (octaves 3 and 4) to establish key center.
 */
export function getCadenceNotes(tonicMidi: number): { name: string; midis: number[] }[] {
  // We offset tonic so it stays around MIDI 48-60 (C3 to C4) for balanced bass/mid chords
  let baseTonic = tonicMidi;
  while (baseTonic > 60) baseTonic -= 12;
  while (baseTonic < 48) baseTonic += 12;

  // I chord: Tonic + Major 3rd + Perfect 5th
  const chordI = [baseTonic, baseTonic + 4, baseTonic + 7];
  // IV chord: Tonic + Perfect 4th + Major 6th
  const chordIV = [baseTonic, baseTonic + 5, baseTonic + 9];
  // V chord: Tonic - 1 (Leading tone) + Major 2nd + Perfect 5th (or similar voicing)
  const chordV = [baseTonic - 1, baseTonic + 2, baseTonic + 7];

  return [
    { name: 'I (Do-Mi-Sol)', midis: chordI },
    { name: 'IV (Fa-La-Do)', midis: chordIV },
    { name: 'V (Ti-Re-Sol)', midis: chordV },
    { name: 'I (Do-Mi-Sol)', midis: chordI },
  ];
}

/**
 * Gets the resolution note path for an incorrect answer or teaching.
 * Returns an array of MIDI notes that guide the ear back to stability.
 */
export function getResolutionNotes(tonicMidi: number, targetDegree: ScaleDegree): number[] {
  const targetMidi = tonicMidi + targetDegree.semitones;
  
  switch (targetDegree.degree) {
    case '7': // Ti strongly resolves to Do (8/Octave)
      return [targetMidi, tonicMidi + 12];
    case '4': // Fa resolves to Mi (3)
      return [targetMidi, tonicMidi + 4];
    case '2': // Re resolves to Do (1) or Mi (3)
      return [targetMidi, tonicMidi];
    case '6': // La resolves to Sol (5)
      return [targetMidi, tonicMidi + 7];
    case 'b2': // Ra resolves to Do (1)
      return [targetMidi, tonicMidi];
    case 'b3': // Me is a stable minor color; reinforce tonic context
      return [targetMidi, tonicMidi];
    case 'b6': // Le resolves to Sol (5)
      return [targetMidi, tonicMidi + 7];
    case 'b7': // Te resolves to La (6) -> Sol (5)
      return [targetMidi, tonicMidi + 9, tonicMidi + 7];
    case '#4': // Fi resolves to Sol (5)
      return [targetMidi, tonicMidi + 7];
    case 'b5': // Se resolves down to Fa (4)
      return [targetMidi, tonicMidi + 5];
    default:
      // Stable notes (1, 3, 5, 8) just play themselves then resolve to tonic if not tonic
      if (targetDegree.degree !== '1' && targetDegree.degree !== '8') {
        return [targetMidi, tonicMidi];
      }
      return [targetMidi];
  }
}
