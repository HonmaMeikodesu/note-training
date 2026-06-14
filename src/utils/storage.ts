import AsyncStorage from '@react-native-async-storage/async-storage';
import { Difficulty } from './music';

export type CadenceMode = 'every' | 'first' | 'manual';

export interface DegreeStats {
  total: number;
  correct: number;
  totalResponseMs: number;
  confusions: {
    [degree: string]: number;
  };
}

export interface UserStats {
  streak: number;
  bestStreak: number;
  lastTrainedDate: string | null; // YYYY-MM-DD
  history: {
    [date: string]: {
      total: number;
      correct: number;
    };
  };
  totalQuestions: number;
  correctQuestions: number;
  degreeStats: {
    [degree: string]: DegreeStats;
  };
}

export interface UserSettings {
  defaultKeyName: string; // 'C', 'G', etc.
  difficulty: Difficulty;
  playCadenceOnStart: boolean;
  cadenceMode: CadenceMode;
  dailyGoal: number;
  showPianoLabels: 'degree' | 'letter' | 'both' | 'none';
}

export interface QuestionAttempt {
  isCorrect: boolean;
  targetDegree: string;
  selectedDegree: string;
  keyName: string;
  difficulty: Difficulty;
  responseMs: number;
}

const STATS_KEY = '@note_train:user_stats';
const SETTINGS_KEY = '@note_train:user_settings';

const DEFAULT_STATS: UserStats = {
  streak: 0,
  bestStreak: 0,
  lastTrainedDate: null,
  history: {},
  totalQuestions: 0,
  correctQuestions: 0,
  degreeStats: {},
};

const DEFAULT_SETTINGS: UserSettings = {
  defaultKeyName: 'C',
  difficulty: 'easy',
  playCadenceOnStart: true,
  cadenceMode: 'first',
  dailyGoal: 20,
  showPianoLabels: 'degree',
};

export async function loadUserStats(): Promise<UserStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw);
    
    // Check if streak needs reset (if user missed a day)
    const stats = { ...DEFAULT_STATS, ...parsed, degreeStats: parsed.degreeStats || {} };
    return checkAndUpdateStreak(stats);
  } catch (e) {
    console.error('Error loading stats', e);
    return DEFAULT_STATS;
  }
}

export async function saveUserStats(stats: UserStats): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Error saving stats', e);
  }
}

export async function loadUserSettings(): Promise<UserSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const cadenceMode: CadenceMode = parsed.cadenceMode || (parsed.playCadenceOnStart ? 'first' : 'manual');
    return { ...DEFAULT_SETTINGS, ...parsed, cadenceMode };
  } catch (e) {
    console.error('Error loading settings', e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving settings', e);
  }
}

/**
 * Helper to check and maintain the streak
 */
function checkAndUpdateStreak(stats: UserStats): UserStats {
  if (!stats.lastTrainedDate) return stats;

  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (stats.lastTrainedDate === today) {
    // Already trained today, streak is safe
    return stats;
  } else if (stats.lastTrainedDate === yesterday) {
    // Last trained yesterday, streak is maintained
    return stats;
  } else {
    // Missed a day, streak resets to 0
    return {
      ...stats,
      streak: 0,
    };
  }
}

/**
 * Records a successful or completed session/question.
 */
export async function recordQuestionAttempt(attemptOrCorrect: QuestionAttempt | boolean): Promise<UserStats> {
  const attempt: QuestionAttempt | null =
    typeof attemptOrCorrect === 'boolean'
      ? null
      : attemptOrCorrect;
  const isCorrect = typeof attemptOrCorrect === 'boolean' ? attemptOrCorrect : attemptOrCorrect.isCorrect;
  const stats = await loadUserStats();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  const dayStats = stats.history[today] || { total: 0, correct: 0 };
  const updatedDayStats = {
    total: dayStats.total + 1,
    correct: dayStats.correct + (isCorrect ? 1 : 0),
  };

  let newStreak = stats.streak;
  
  // Update streak if this is the first training of today
  if (stats.lastTrainedDate !== today) {
    if (stats.lastTrainedDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1; // reset or start new
    }
  }

  const bestStreak = Math.max(stats.bestStreak, newStreak);
  const degreeStats = { ...stats.degreeStats };

  if (attempt) {
    const currentDegreeStats = degreeStats[attempt.targetDegree] || {
      total: 0,
      correct: 0,
      totalResponseMs: 0,
      confusions: {},
    };

    degreeStats[attempt.targetDegree] = {
      total: currentDegreeStats.total + 1,
      correct: currentDegreeStats.correct + (attempt.isCorrect ? 1 : 0),
      totalResponseMs: currentDegreeStats.totalResponseMs + attempt.responseMs,
      confusions: attempt.isCorrect
        ? currentDegreeStats.confusions
        : {
            ...currentDegreeStats.confusions,
            [attempt.selectedDegree]: (currentDegreeStats.confusions[attempt.selectedDegree] || 0) + 1,
          },
    };
  }

  const updatedStats: UserStats = {
    ...stats,
    streak: newStreak,
    bestStreak,
    lastTrainedDate: today,
    totalQuestions: stats.totalQuestions + 1,
    correctQuestions: stats.correctQuestions + (isCorrect ? 1 : 0),
    degreeStats,
    history: {
      ...stats.history,
      [today]: updatedDayStats,
    },
  };

  await saveUserStats(updatedStats);
  return updatedStats;
}

// Utility date functions
export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
