import { Audio } from 'expo-av';
import { getNoteAudioUrl } from './music';

class AudioService {
  private soundCache: Map<number, Audio.Sound> = new Map();
  private isLoading: Map<number, boolean> = new Map();

  constructor() {
    // Configure audio mode for responsive and correct playback
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    }).catch(err => console.log('Audio init warning:', err));
  }

  /**
   * Preload a specific note by its MIDI number.
   * If already loaded or loading, does nothing.
   */
  async preloadNote(midi: number): Promise<void> {
    if (this.soundCache.has(midi) || this.isLoading.get(midi)) {
      return;
    }

    this.isLoading.set(midi, true);
    try {
      const url = getNoteAudioUrl(midi);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false, volume: 1.0 }
      );
      this.soundCache.set(midi, sound);
    } catch (error) {
      console.warn(`Failed to preload MIDI ${midi}:`, error);
    } finally {
      this.isLoading.delete(midi);
    }
  }

  /**
   * Preload a range or list of MIDI notes
   */
  async preloadNotes(midis: number[]): Promise<void> {
    await Promise.all(midis.map(midi => this.preloadNote(midi)));
  }

  /**
   * Play a single MIDI note.
   * If cached, plays immediately. Otherwise loads on the fly (with slight latency).
   */
  async playNote(midi: number, volume: number = 1.0): Promise<void> {
    try {
      let sound = this.soundCache.get(midi);

      if (!sound) {
        const url = getNoteAudioUrl(midi);
        const result = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true, volume }
        );
        sound = result.sound;
        this.soundCache.set(midi, sound);
        return;
      }

      // If cached, reset position and play
      await sound.setStatusAsync({
        shouldPlay: true,
        positionMillis: 0,
        volume,
      });
    } catch (error) {
      console.warn(`Error playing MIDI ${midi}:`, error);
    }
  }

  /**
   * Play multiple MIDI notes as a chord simultaneously
   */
  async playChord(midis: number[], volume: number = 0.8): Promise<void> {
    await Promise.all(midis.map(midi => this.playNote(midi, volume)));
  }

  /**
   * Play a full cadence (e.g. I - IV - V - I) with a specified delay between chords
   */
  async playCadence(
    cadence: { name: string; midis: number[] }[],
    chordDurationMs: number = 1000,
    onChordStart?: (index: number, name: string) => void
  ): Promise<void> {
    for (let i = 0; i < cadence.length; i++) {
      const chord = cadence[i];
      if (onChordStart) {
        onChordStart(i, chord.name);
      }
      // Play the chord
      this.playChord(chord.midis);
      
      // Wait for next chord
      if (i < cadence.length - 1) {
        await new Promise(resolve => setTimeout(resolve, chordDurationMs));
      }
    }
  }

  /**
   * Unload specific notes to free up memory (e.g., when changing keys)
   */
  async unloadNotes(midis: number[]): Promise<void> {
    for (const midi of midis) {
      const sound = this.soundCache.get(midi);
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch (e) {
          // Ignore
        }
        this.soundCache.delete(midi);
      }
    }
  }

  /**
   * Clean up all loaded sound objects in cache
   */
  async clearCache(): Promise<void> {
    const promises = Array.from(this.soundCache.values()).map(async (sound) => {
      try {
        await sound.unloadAsync();
      } catch (e) {
        // Ignore
      }
    });
    await Promise.all(promises);
    this.soundCache.clear();
  }
}

export const audioService = new AudioService();
