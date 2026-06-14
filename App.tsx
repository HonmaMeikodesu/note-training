import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import {
  KEYS,
  SCALE_DEGREES,
  DIFFICULTIES,
  Key,
  ScaleDegree,
  Difficulty,
  getCadenceNotes,
  getDifficultyConfig,
  getResolutionNotes,
  getScaleDegreeForSemitones,
  getScaleDegreesForDifficulty,
  midiToNoteName,
} from './src/utils/music';
import { audioService } from './src/utils/audio';
import {
  loadUserStats,
  loadUserSettings,
  saveUserSettings,
  recordQuestionAttempt,
  getTodayString,
  CadenceMode,
  UserStats,
  UserSettings,
} from './src/utils/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = 'dashboard' | 'trainer' | 'keyboard' | 'settings';

const CADENCE_MODE_LABELS: Record<CadenceMode, string> = {
  every: '每题建立',
  first: '每组首题',
  manual: '手动',
};

const DAILY_GOAL_OPTIONS = [10, 20, 50];

function pickWeightedDegree(allowedDegrees: ScaleDegree[], stats: UserStats | null): ScaleDegree {
  if (!stats) {
    return allowedDegrees[Math.floor(Math.random() * allowedDegrees.length)];
  }

  const weighted = allowedDegrees.map((degree) => {
    const degreeStats = stats.degreeStats[degree.degree];
    if (!degreeStats || degreeStats.total < 3) {
      return { degree, weight: 3 };
    }

    const accuracy = degreeStats.correct / degreeStats.total;
    const avgResponseMs = degreeStats.totalResponseMs / degreeStats.total;
    const accuracyWeight = 1 + (1 - accuracy) * 8;
    const speedWeight = avgResponseMs > 5000 ? 2 : avgResponseMs > 3000 ? 1 : 0;

    return { degree, weight: accuracyWeight + speedWeight };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.degree;
  }

  return weighted[weighted.length - 1].degree;
}

function getWeakDegreeSummary(stats: UserStats | null): string {
  if (!stats) return '暂无训练数据';

  const ranked = Object.entries(stats.degreeStats)
    .filter(([, value]) => value.total >= 3)
    .map(([degree, value]) => ({
      degree,
      total: value.total,
      accuracy: value.correct / value.total,
      avgResponseMs: Math.round(value.totalResponseMs / value.total),
      confusions: value.confusions,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.avgResponseMs - a.avgResponseMs);

  if (ranked.length === 0) return '完成更多题后会显示薄弱音级';

  const weakest = ranked[0];
  const confusion = Object.entries(weakest.confusions).sort((a, b) => b[1] - a[1])[0];
  const base = `${weakest.degree}: ${Math.round(weakest.accuracy * 100)}%, ${(
    weakest.avgResponseMs / 1000
  ).toFixed(1)}s`;

  return confusion ? `${base}, 常误选 ${confusion[0]}` : base;
}

function getModeName(difficulty: Difficulty): string {
  return difficulty === 'minor' ? '小调' : '大调';
}

export default function App() {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Stats & Settings
  const [stats, setStats] = useState<UserStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Trainer State
  const [trainerKey, setTrainerKey] = useState<Key>(KEYS[0]); // default C
  const [cadencePlaying, setCadencePlaying] = useState<boolean>(false);
  const [currentChordName, setCurrentChordName] = useState<string>('');
  const [targetDegree, setTargetDegree] = useState<ScaleDegree | null>(null);
  const [targetMidi, setTargetMidi] = useState<number | null>(null);
  const [hasGuessed, setHasGuessed] = useState<boolean>(false);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [questionIndex, setQuestionIndex] = useState<number>(1);
  const [sessionCorrect, setSessionCorrect] = useState<number>(0);
  const [sessionTotal, setSessionTotal] = useState<number>(0);
  const [trainerPianoInput, setTrainerPianoInput] = useState<boolean>(false);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(Date.now());
  const [lastResponseMs, setLastResponseMs] = useState<number>(0);

  // Keyboard Sandbox State
  const [sandboxKey, setSandboxKey] = useState<Key>(KEYS[0]); // default C
  const [activePianoMidi, setActivePianoMidi] = useState<number | null>(null);
  const [pianoOctaveOffset, setPianoOctaveOffset] = useState<number>(0); // 0 = Octave 4/5, -1 = Octave 3/4, etc.

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load stats and settings on start
  useEffect(() => {
    async function init() {
      try {
        const loadedStats = await loadUserStats();
        const loadedSettings = await loadUserSettings();
        setStats(loadedStats);
        setSettings(loadedSettings);

        // Find match in KEYS
        const matchedKey = KEYS.find(k => k.name === loadedSettings.defaultKeyName) || KEYS[0];
        setTrainerKey(matchedKey);
        setSandboxKey(matchedKey);

        // Preload essential notes for current key
        preloadKeyNotes(matchedKey);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Preload sound files for the active key to make playback instant
  const preloadKeyNotes = async (key: Key) => {
    const cadence = getCadenceNotes(key.tonicMidi);
    const cadenceMidis = cadence.flatMap(c => c.midis);
    
    // Preload every unique pitch class used by supported degree spellings.
    const scaleMidis = Array.from(
      new Set(SCALE_DEGREES.map(deg => key.tonicMidi + deg.semitones))
    );
    
    // Combine and deduplicate
    const midisToLoad = Array.from(new Set([...cadenceMidis, ...scaleMidis]));
    await audioService.preloadNotes(midisToLoad);
  };

  // Animate tab transitions
  const handleTabChange = (tab: Tab) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  // Preload sandbox when key changes
  useEffect(() => {
    if (settings) {
      preloadKeyNotes(sandboxKey);
    }
  }, [sandboxKey]);

  // Start trainer session / generate question
  const startTrainerSession = () => {
    setQuestionIndex(1);
    setSessionCorrect(0);
    setSessionTotal(0);
    generateQuestion(trainerKey, 1);
    handleTabChange('trainer');
  };

  // Generate a new target question
  const generateQuestion = (currentKey: Key, nextIndex: number = questionIndex) => {
    if (!settings) return;

    const allowedDegrees = getScaleDegreesForDifficulty(settings.difficulty);

    // Bias toward weak scale degrees while preserving randomness.
    const randomDegree = pickWeightedDegree(allowedDegrees, stats);
    const midi = currentKey.tonicMidi + randomDegree.semitones;

    setTargetDegree(randomDegree);
    setTargetMidi(midi);
    setHasGuessed(false);
    setSelectedGuess(null);
    setIsCorrect(false);
    setLastResponseMs(0);

    const shouldPlayCadence =
      settings.cadenceMode === 'every' ||
      (settings.cadenceMode === 'first' && nextIndex === 1) ||
      (!settings.cadenceMode && settings.playCadenceOnStart && nextIndex === 1);

    if (shouldPlayCadence) {
      playCadenceAndTarget(currentKey, midi);
    } else {
      // Just preload and play the target note
      audioService.preloadNote(midi).then(() => {
        setQuestionStartedAt(Date.now());
        audioService.playNote(midi);
      });
    }
  };

  // Play established cadence, then play target note
  const playCadenceAndTarget = async (currentKey: Key, targetM: number) => {
    if (cadencePlaying) return;
    setCadencePlaying(true);
    
    try {
      const cadence = getCadenceNotes(currentKey.tonicMidi);
      await audioService.playCadence(cadence, 800, (idx, name) => {
        setCurrentChordName(name);
      });
      setCurrentChordName('准备听目标音...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentChordName('听！');
      
      // Flash target note
      triggerTargetPulse();
      setQuestionStartedAt(Date.now());
      await audioService.playNote(targetM);
    } catch (e) {
      console.warn(e);
    } finally {
      setCadencePlaying(false);
      setCurrentChordName('');
    }
  };

  // Target single play
  const playTargetNote = async () => {
    if (targetMidi) {
      triggerTargetPulse();
      await audioService.playNote(targetMidi);
    }
  };

  const triggerTargetPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Handle User Guess (either from Scale Degree button or Piano Keyboard)
  const handleGuess = async (degree: ScaleDegree) => {
    if (hasGuessed || !targetDegree || !targetMidi) return;

    const correct = degree.degree === targetDegree.degree;
    const responseMs = Math.max(0, Date.now() - questionStartedAt);
    setIsCorrect(correct);
    setSelectedGuess(degree.degree);
    setHasGuessed(true);
    setLastResponseMs(responseMs);

    setSessionTotal(prev => prev + 1);
    if (correct) {
      setSessionCorrect(prev => prev + 1);
    }

    // Play visual & sound response
    if (correct) {
      // Play resolution (guide the ear nicely back to home scale)
      const resolution = getResolutionNotes(trainerKey.tonicMidi, targetDegree);
      for (const m of resolution) {
        await audioService.playNote(m);
        await new Promise(r => setTimeout(r, 400));
      }
    } else {
      // Just play correct note and then its resolution
      await audioService.playNote(targetMidi);
      await new Promise(r => setTimeout(r, 600));
      const resolution = getResolutionNotes(trainerKey.tonicMidi, targetDegree);
      for (const m of resolution) {
        await audioService.playNote(m);
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // Save to database/AsyncStorage
    const updatedStats = await recordQuestionAttempt({
      isCorrect: correct,
      targetDegree: targetDegree.degree,
      selectedDegree: degree.degree,
      keyName: trainerKey.name,
      difficulty: settings?.difficulty || 'easy',
      responseMs,
    });
    setStats(updatedStats);
  };

  const nextQuestion = () => {
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    generateQuestion(trainerKey, nextIndex);
  };

  // Change key inside training
  const handleTrainerKeyChange = (key: Key) => {
    setTrainerKey(key);
    preloadKeyNotes(key).then(() => {
      generateQuestion(key, questionIndex);
    });
  };

  // Play piano key in sandbox
  const playSandboxPianoKey = (midi: number) => {
    setActivePianoMidi(midi);
    audioService.playNote(midi);
    setTimeout(() => {
      setActivePianoMidi(null);
    }, 200);
  };

  // Piano Key rendering helpers
  const getRelativeDegreeForMidi = (midi: number, tonicKey: Key): ScaleDegree | null => {
    const semitones = midi - tonicKey.tonicMidi;
    const diffConfig = settings ? getDifficultyConfig(settings.difficulty) : null;
    return getScaleDegreeForSemitones(semitones, diffConfig?.degrees || []);
  };

  const renderPianoKeyboard = (
    tonicKey: Key,
    onKeyPress: (midi: number) => void,
    activeMidi: number | null,
    highlightedMidi: number | null = null
  ) => {
    const baseMidi = tonicKey.tonicMidi + (pianoOctaveOffset * 12);

    // 10 White Keys
    // C, D, E, F, G, A, B, C, D, E
    const whiteKeysOffsets = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
    
    // Black Keys: placed on top of whites
    // C#, D#, F#, G#, A#, C#, D#
    // Maps [whiteKeyIndexBefore, offset]
    const blackKeysConfig = [
      { leftIndex: 0, offset: 1, midiOffset: 1 },
      { leftIndex: 1, offset: 3, midiOffset: 3 },
      { leftIndex: 3, offset: 6, midiOffset: 6 },
      { leftIndex: 4, offset: 8, midiOffset: 8 },
      { leftIndex: 5, offset: 10, midiOffset: 10 },
      { leftIndex: 7, offset: 13, midiOffset: 13 },
      { leftIndex: 8, offset: 15, midiOffset: 15 },
    ];

    const containerWidth = SCREEN_WIDTH - 32;
    const whiteKeyWidth = containerWidth / 10;
    const blackKeyWidth = whiteKeyWidth * 0.65;
    const blackKeyHeight = 90;

    return (
      <View style={styles.pianoWrapper}>
        <View style={[styles.pianoContainer, { width: containerWidth }]}>
          {/* Render White Keys */}
          <View style={styles.whiteKeysContainer}>
            {whiteKeysOffsets.map((offset, idx) => {
              const midi = baseMidi + offset;
              const relativeDegree = getRelativeDegreeForMidi(midi, tonicKey);
              const isPressed = activeMidi === midi;
              const isHighlight = highlightedMidi === midi;

              return (
                <TouchableOpacity
                  key={`white-${idx}`}
                  activeOpacity={0.8}
                  style={[
                    styles.whiteKey,
                    { width: whiteKeyWidth },
                    isPressed && styles.whiteKeyActive,
                    isHighlight && styles.keyHighlighted,
                  ]}
                  onPress={() => onKeyPress(midi)}
                >
                  <View style={styles.keyLabelContainer}>
                    {settings?.showPianoLabels !== 'none' && relativeDegree && (
                      <Text style={[styles.pianoLabel, { color: relativeDegree.color }]}>
                        {settings?.showPianoLabels === 'degree' && relativeDegree.degree}
                        {settings?.showPianoLabels === 'letter' && midiToNoteName(midi).slice(0, -1)}
                        {settings?.showPianoLabels === 'both' && `${relativeDegree.degree}\n${midiToNoteName(midi).slice(0, -1)}`}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Render Black Keys */}
          {blackKeysConfig.map((black, idx) => {
            const midi = baseMidi + black.midiOffset;
            const relativeDegree = getRelativeDegreeForMidi(midi, tonicKey);
            const isPressed = activeMidi === midi;
            const isHighlight = highlightedMidi === midi;

            // Calculate left offset position
            const leftPosition = (black.leftIndex + 1) * whiteKeyWidth - (blackKeyWidth / 2);

            return (
              <TouchableOpacity
                key={`black-${idx}`}
                activeOpacity={0.8}
                style={[
                  styles.blackKey,
                  {
                    left: leftPosition,
                    width: blackKeyWidth,
                    height: blackKeyHeight,
                  },
                  isPressed && styles.blackKeyActive,
                  isHighlight && styles.keyHighlighted,
                ]}
                onPress={() => onKeyPress(midi)}
              >
                <View style={[styles.keyLabelContainer, { bottom: 10 }]}>
                  {settings?.showPianoLabels !== 'none' && relativeDegree && (
                    <Text style={[styles.pianoLabelBlack, { color: relativeDegree.color }]}>
                      {settings?.showPianoLabels === 'degree' && relativeDegree.degree}
                      {settings?.showPianoLabels === 'letter' && midiToNoteName(midi).slice(0, -1)}
                      {settings?.showPianoLabels === 'both' && `${relativeDegree.degree}\n${midiToNoteName(midi).slice(0, -1)}`}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Octave Controls */}
        <View style={styles.pianoOctaveRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => setPianoOctaveOffset(prev => Math.max(-2, prev - 1))}
          >
            <Text style={styles.smallButtonText}>低音区 ⬇</Text>
          </TouchableOpacity>
          <Text style={styles.pianoOctaveText}>
            当前八度偏移: {pianoOctaveOffset === 0 ? '标准 (4/5组)' : `${pianoOctaveOffset > 0 ? '+' : ''}${pianoOctaveOffset}`}
          </Text>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => setPianoOctaveOffset(prev => Math.min(2, prev + 1))}
          >
            <Text style={styles.smallButtonText}>高音区 ⬆</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Settings Actions
  const updateDifficultySetting = async (diff: Difficulty) => {
    if (!settings) return;
    const newSettings = { ...settings, difficulty: diff };
    setSettings(newSettings);
    await saveUserSettings(newSettings);
  };

  const updateKeySetting = async (keyName: string) => {
    if (!settings) return;
    const newSettings = { ...settings, defaultKeyName: keyName };
    setSettings(newSettings);
    await saveUserSettings(newSettings);

    const matchedKey = KEYS.find(k => k.name === keyName);
    if (matchedKey) {
      setTrainerKey(matchedKey);
      setSandboxKey(matchedKey);
      preloadKeyNotes(matchedKey);
    }
  };

  const updateLabelSetting = async (labelStyle: 'degree' | 'letter' | 'both' | 'none') => {
    if (!settings) return;
    const newSettings = { ...settings, showPianoLabels: labelStyle };
    setSettings(newSettings);
    await saveUserSettings(newSettings);
  };

  const updateCadenceModeSetting = async (cadenceMode: CadenceMode) => {
    if (!settings) return;
    const newSettings = {
      ...settings,
      cadenceMode,
      playCadenceOnStart: cadenceMode !== 'manual',
    };
    setSettings(newSettings);
    await saveUserSettings(newSettings);
  };

  const updateDailyGoalSetting = async (dailyGoal: number) => {
    if (!settings) return;
    const newSettings = { ...settings, dailyGoal };
    setSettings(newSettings);
    await saveUserSettings(newSettings);
  };

  const clearStatsHistory = () => {
    Alert.alert('重置记录', '确定要清除所有的每日打卡和训练数据吗？此操作不可逆。', [
      { text: '取消', style: 'cancel' },
      {
        text: '重置',
        style: 'destructive',
        onPress: async () => {
          const resetStats = {
            streak: 0,
            bestStreak: 0,
            lastTrainedDate: null,
            history: {},
            totalQuestions: 0,
            correctQuestions: 0,
            degreeStats: {},
          };
          setStats(resetStats);
          const { saveUserStats } = require('./src/utils/storage');
          await saveUserStats(resetStats);
          Alert.alert('已重置', '历史训练记录已被清空。');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>视唱练耳实验室初始化中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" />

      {/* Main Content Area with Fade Transition */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && stats && settings && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerSubtitle}>相对音感每日特训</Text>
                <Text style={styles.headerTitle}>EAR TRAINER</Text>
              </View>
              <TouchableOpacity
                style={styles.headerSettingBtn}
                onPress={() => handleTabChange('settings')}
              >
                <Text style={styles.headerSettingIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>

            {/* Daily Streak Card */}
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <View style={styles.streakInfo}>
                <Text style={styles.streakCount}>{stats.streak} 天</Text>
                <Text style={styles.streakLabel}>连续打卡训练天数</Text>
              </View>
              <View style={styles.bestStreakBadge}>
                <Text style={styles.bestStreakText}>最佳: {stats.bestStreak}天</Text>
              </View>
            </View>

            {/* Quick Progress Indicator */}
            <View style={styles.todayProgressCard}>
              <Text style={styles.cardSectionTitle}>📅 今日训练进度</Text>
              {(() => {
                const todayStr = getTodayString();
                const todayData = stats.history[todayStr] || { total: 0, correct: 0 };
                const goal = settings.dailyGoal || 20;
                const pct = Math.min(100, Math.round((todayData.total / goal) * 100));

                return (
                  <View style={styles.progressInner}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressNum}>{todayData.total} / {goal} 题</Text>
                      <Text style={styles.progressPct}>完成度 {pct}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.todayStatsMini}>
                      今日答对: {todayData.correct} 题 | 今日准确率: {todayData.total > 0 ? Math.round((todayData.correct / todayData.total) * 100) : 0}%
                    </Text>
                    <Text style={styles.todayStatsMini}>
                      薄弱音级: {getWeakDegreeSummary(stats)}
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Start Training CTA */}
            <TouchableOpacity
              style={styles.mainStartButton}
              activeOpacity={0.9}
              onPress={startTrainerSession}
            >
              <Text style={styles.mainStartButtonText}>🚀 开始今日相对音感训练</Text>
              <Text style={styles.mainStartButtonSub}>
                调性: {trainerKey.name} {getModeName(settings.difficulty)} | 难度: {getDifficultyConfig(settings.difficulty).name}
              </Text>
            </TouchableOpacity>

            {/* Mode Selector Cards */}
            <Text style={styles.sectionTitle}>🎯 专属训练模式</Text>
            
            <TouchableOpacity
              style={styles.modeCard}
              onPress={startTrainerSession}
            >
              <View style={[styles.modeIconCircle, { backgroundColor: '#4F46E5' }]}>
                <Text style={styles.modeIcon}>🎵</Text>
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={styles.modeTitle}>首调功能音感训练</Text>
                <Text style={styles.modeDesc}>在和弦建立的调性感觉中，听辨并找出单音在唱名系统中的相对功能。训练“一听就懂简谱”的能力。</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modeCard}
              onPress={() => handleTabChange('keyboard')}
            >
              <View style={[styles.modeIconCircle, { backgroundColor: '#10B981' }]}>
                <Text style={styles.modeIcon}>🎹</Text>
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={styles.modeTitle}>自由钢琴键盘沙盒</Text>
                <Text style={styles.modeDesc}>自由弹奏与识谱。实时标注任何按键在当前调性中的首调唱名，帮助您在大脑中建立音高与唱名的神经反射。</Text>
              </View>
            </TouchableOpacity>

            {/* Stats Summary */}
            <View style={styles.statsSummaryCard}>
              <Text style={styles.cardSectionTitle}>📈 个人总训练统计</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statsGridItem}>
                  <Text style={styles.statsGridNum}>{stats.totalQuestions}</Text>
                  <Text style={styles.statsGridLabel}>累计听音题</Text>
                </View>
                <View style={styles.statsGridItem}>
                  <Text style={styles.statsGridNum}>{stats.correctQuestions}</Text>
                  <Text style={styles.statsGridLabel}>累计答对</Text>
                </View>
                <View style={styles.statsGridItem}>
                  <Text style={[styles.statsGridNum, { color: '#10B981' }]}>
                    {stats.totalQuestions > 0 ? Math.round((stats.correctQuestions / stats.totalQuestions) * 100) : 0}%
                  </Text>
                  <Text style={styles.statsGridLabel}>历史准确率</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {/* TAB 2: FUNCTIONAL TRAINER */}
        {activeTab === 'trainer' && settings && (
          <View style={styles.trainerContainer}>
            {/* Trainer Header */}
            <View style={styles.trainerHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => handleTabChange('dashboard')}
              >
                <Text style={styles.backButtonText}>◁ 退出</Text>
              </TouchableOpacity>
              <View style={styles.trainerHeaderTitle}>
                <Text style={styles.trainerTitleText}>{trainerKey.name} {getModeName(settings.difficulty)}首调听辨</Text>
                <Text style={styles.trainerLevelText}>{getDifficultyConfig(settings.difficulty).name}</Text>
              </View>
              <View style={styles.trainerScoreBadge}>
                <Text style={styles.trainerScoreText}>得分: {sessionCorrect}/{sessionTotal}</Text>
              </View>
            </View>

            {/* Training Flow Content */}
            <ScrollView contentContainerStyle={styles.trainerBody}>
              
              {/* Top Key Selector within training */}
              <View style={styles.trainerKeySelectorCard}>
                <Text style={styles.keySelectorLabel}>快速切换训练主调：</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.keySelectorScroll}>
                  {KEYS.map((k) => (
                    <TouchableOpacity
                      key={k.name}
                      style={[
                        styles.keySelectorBadge,
                        trainerKey.name === k.name && styles.keySelectorBadgeActive,
                      ]}
                      onPress={() => handleTrainerKeyChange(k)}
                    >
                      <Text style={[
                        styles.keySelectorBadgeText,
                        trainerKey.name === k.name && styles.keySelectorBadgeTextActive
                      ]}>
                        {k.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Central Sound Playpad */}
              <View style={styles.playpadCard}>
                <Text style={styles.playpadHelp}>第一步：建立并稳固脑海里的调性中心</Text>
                
                <TouchableOpacity
                  style={[styles.cadenceButton, cadencePlaying && styles.cadenceButtonPlaying]}
                  onPress={() => targetMidi && playCadenceAndTarget(trainerKey, targetMidi)}
                  disabled={cadencePlaying}
                >
                  <Text style={styles.cadenceButtonText}>
                    {cadencePlaying ? `正在和弦建立 [ ${currentChordName} ]` : '🔊 建立调性 + 听目标音'}
                  </Text>
                  <Text style={styles.cadenceButtonSub}>顺序播放标准 I - IV - V - I 进行建立耳蜗坐标</Text>
                </TouchableOpacity>

                <Text style={styles.playpadHelp}>第二步：反复聆听未知目标音，感知其张力倾向</Text>

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={styles.targetButton}
                    onPress={playTargetNote}
                    disabled={cadencePlaying}
                  >
                    <Text style={styles.targetButtonText}>🎵 单独播放目标音</Text>
                    <Text style={styles.targetButtonSub}>听听它是什么功能（Do Re Mi Fa Sol La Ti）</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Feedback Alert box */}
              {hasGuessed && targetDegree && (
                <View style={[
                  styles.feedbackCard,
                  isCorrect ? styles.feedbackCardCorrect : styles.feedbackCardIncorrect
                ]}>
                  <Text style={[styles.feedbackTitle, { color: isCorrect ? '#10B981' : '#EF4444' }]}>
                    {isCorrect ? '✨ 听觉完美！回答正确' : '🎯 没关系，让耳朵加深印象'}
                  </Text>
                  <Text style={styles.feedbackDesc}>
                    目标音是：
                    <Text style={[styles.feedbackHighlight, { color: targetDegree.color }]}>
                      {targetDegree.degree} ({targetDegree.solfege})
                    </Text>
                    ，对应钢琴琴键：{midiToNoteName(targetMidi || 60).slice(0, -1)}
                  </Text>
                  <Text style={styles.feedbackAnalysis}>
                    本题反应时间：{(lastResponseMs / 1000).toFixed(1)}s
                  </Text>
                  {isCorrect ? (
                    <Text style={styles.feedbackAnalysis}>稳定解决！听觉记忆在慢慢增强！</Text>
                  ) : (
                    <Text style={styles.feedbackAnalysis}>
                      听听它的张力走向，它具有强烈的倾向，正逐步解决过渡到主音。
                    </Text>
                  )}
                  
                  <TouchableOpacity style={styles.nextButton} onPress={nextQuestion}>
                    <Text style={styles.nextButtonText}>下一题 ➔</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Third Step: Pitch Input Selection */}
              <View style={styles.inputCard}>
                <View style={styles.inputTabs}>
                  <TouchableOpacity
                    style={[styles.inputTab, !trainerPianoInput && styles.inputTabActive]}
                    onPress={() => setTrainerPianoInput(false)}
                  >
                    <Text style={[styles.inputTabText, !trainerPianoInput && styles.inputTabTextActive]}>
                      🎛️ 首调唱名按钮选择
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inputTab, trainerPianoInput && styles.inputTabActive]}
                    onPress={() => setTrainerPianoInput(true)}
                  >
                    <Text style={[styles.inputTabText, trainerPianoInput && styles.inputTabTextActive]}>
                      🎹 配合虚拟键盘找音
                    </Text>
                  </TouchableOpacity>
                </View>

                {!trainerPianoInput ? (
                  /* Standard Button Matrix */
                  <View style={styles.degreeButtonGrid}>
                    {getScaleDegreesForDifficulty(settings.difficulty).map((deg) => {
                      const isSelected = selectedGuess === deg.degree;
                      const isCorrectAnswer = deg.degree === targetDegree?.degree;
                      
                      const btnStyle: any[] = [styles.degreeBtn];
                      const textStyle: any[] = [styles.degreeBtnText];
                      
                      if (hasGuessed) {
                        if (isCorrectAnswer) {
                          btnStyle.push(styles.degreeBtnCorrect);
                        } else if (isSelected) {
                          btnStyle.push(styles.degreeBtnIncorrect);
                        } else {
                          btnStyle.push(styles.degreeBtnDisabled);
                        }
                      }

                      return (
                        <TouchableOpacity
                          key={deg.degree}
                          activeOpacity={0.7}
                          style={btnStyle}
                          disabled={hasGuessed || cadencePlaying}
                          onPress={() => handleGuess(deg)}
                        >
                          <Text style={[styles.degreeBtnNum, { color: deg.color }]}>{deg.degree}</Text>
                          <Text style={styles.degreeBtnSolfege}>{deg.solfege}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  /* Live Piano Input inside trainer */
                  <View style={styles.trainerPianoWrapper}>
                    <Text style={styles.pianoInputHint}>
                      请在下方琴键中，试弹并找出对应刚才那个目标单音的琴键：
                    </Text>
                    {renderPianoKeyboard(
                      trainerKey,
                      (midi) => {
                        if (hasGuessed) {
                          audioService.playNote(midi);
                          return;
                        }
                        // Guess from midi
                        const relativeDegree = getRelativeDegreeForMidi(midi, trainerKey);
                        if (relativeDegree) {
                          // Check if relative degree is in allowed degrees
                          const diffConfig = getDifficultyConfig(settings.difficulty);
                          if (diffConfig.degrees.includes(relativeDegree.degree)) {
                            handleGuess(relativeDegree);
                          } else {
                            // play standard key
                            audioService.playNote(midi);
                          }
                        }
                      },
                      activePianoMidi,
                      hasGuessed && targetMidi ? targetMidi : null // highlight correct answer key once guessed
                    )}
                  </View>
                )}
              </View>

            </ScrollView>
          </View>
        )}

        {/* TAB 3: KEYBOARD SANDBOX */}
        {activeTab === 'keyboard' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerSubtitle}>自由演奏与唱名反射</Text>
                <Text style={styles.headerTitle}>PIANO SANDBOX</Text>
              </View>
              <TouchableOpacity
                style={styles.headerSettingBtn}
                onPress={() => handleTabChange('dashboard')}
              >
                <Text style={styles.headerSettingIcon}>🏠</Text>
              </TouchableOpacity>
            </View>

            {/* Intro Instructions */}
            <View style={styles.sandboxIntroCard}>
              <Text style={styles.sandboxIntroTitle}>💡 自由练习指南</Text>
              <Text style={styles.sandboxIntroText}>
                在下方琴键上随意演奏，感受琴键位置。顶部的标签展示其在所选调性中的
                <Text style={{ fontWeight: 'bold', color: '#6366F1' }}> 首调唱名（1 2 3...）</Text>
                。这可以帮助您快速习惯把听到的绝对高度转换为相对唱名反射！
              </Text>
            </View>

            {/* Configuration row */}
            <View style={styles.sandboxConfigRow}>
              <View style={styles.sandboxConfigCol}>
                <Text style={styles.sandboxConfigLabel}>设置主调：</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.keySelectorScroll}>
                  {KEYS.map((k) => (
                    <TouchableOpacity
                      key={k.name}
                      style={[
                        styles.keySelectorBadge,
                        sandboxKey.name === k.name && styles.keySelectorBadgeActive,
                      ]}
                      onPress={() => setSandboxKey(k)}
                    >
                      <Text style={[
                        styles.keySelectorBadgeText,
                        sandboxKey.name === k.name && styles.keySelectorBadgeTextActive
                      ]}>
                        {k.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Play cadence inside sandbox to establish tune */}
            <TouchableOpacity
              style={[styles.sandboxCadenceButton, cadencePlaying && styles.cadenceButtonPlaying]}
              onPress={() => {
                if (cadencePlaying) return;
                setCadencePlaying(true);
                const cadence = getCadenceNotes(sandboxKey.tonicMidi);
                audioService.playCadence(cadence, 800).finally(() => setCadencePlaying(false));
              }}
              disabled={cadencePlaying}
            >
              <Text style={styles.sandboxCadenceText}>
                {cadencePlaying ? '正在建立调性感觉...' : `🔊 播放 ${sandboxKey.name} 大调建立和弦进行 (I-IV-V-I)`}
              </Text>
            </TouchableOpacity>

            {/* Piano Keyboard Wrapper */}
            <View style={styles.keyboardSandboxArea}>
              {renderPianoKeyboard(sandboxKey, playSandboxPianoKey, activePianoMidi)}
            </View>

            {/* Label style toggler */}
            <View style={styles.labelStyleCard}>
              <Text style={styles.cardSectionTitle}>🏷️ 琴键显示标签样式</Text>
              <View style={styles.labelStyleGrid}>
                {(['degree', 'letter', 'both', 'none'] as const).map((style) => (
                  <TouchableOpacity
                    key={style}
                    style={[
                      styles.labelStyleBtn,
                      settings?.showPianoLabels === style && styles.labelStyleBtnActive,
                    ]}
                    onPress={() => updateLabelStyleInSandbox(style)}
                  >
                    <Text style={[
                      styles.labelStyleBtnText,
                      settings?.showPianoLabels === style && styles.labelStyleBtnTextActive,
                    ]}>
                      {style === 'degree' && '首调简谱 (1 2 3)'}
                      {style === 'letter' && '音名字母 (C D E)'}
                      {style === 'both' && '简谱 + 音名'}
                      {style === 'none' && '无 (盲弹挑战)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </ScrollView>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && settings && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerSubtitle}>个性化视唱练耳配置</Text>
                <Text style={styles.headerTitle}>SETTINGS</Text>
              </View>
              <TouchableOpacity
                style={styles.headerSettingBtn}
                onPress={() => handleTabChange('dashboard')}
              >
                <Text style={styles.headerSettingIcon}>🏠</Text>
              </TouchableOpacity>
            </View>

            {/* Training Key Setting */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSecTitle}>默认训练主调 (Default Key)</Text>
              <Text style={styles.settingsSecDesc}>每次打开APP和新训练时默认进入的调式</Text>
              <View style={styles.settingsKeyGrid}>
                {KEYS.map((k) => (
                  <TouchableOpacity
                    key={k.name}
                    style={[
                      styles.settingsKeyBtn,
                      settings.defaultKeyName === k.name && styles.settingsKeyBtnActive,
                    ]}
                    onPress={() => updateKeySetting(k.name)}
                  >
                    <Text style={[
                      styles.settingsKeyBtnText,
                      settings.defaultKeyName === k.name && styles.settingsKeyBtnTextActive,
                    ]}>
                      {k.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Difficulty Setting */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSecTitle}>默认训练级别 (Difficulty)</Text>
              <Text style={styles.settingsSecDesc}>首调听辨包含的音阶音级范围</Text>
              {DIFFICULTIES.map((diff) => (
                <TouchableOpacity
                  key={diff.id}
                  style={[
                    styles.diffSettingRow,
                    settings.difficulty === diff.id && styles.diffSettingRowActive,
                  ]}
                  onPress={() => updateDifficultySetting(diff.id)}
                >
                  <View style={styles.diffSettingRadio}>
                    <View style={[
                      styles.diffSettingRadioInner,
                      settings.difficulty === diff.id && styles.diffSettingRadioInnerActive,
                    ]} />
                  </View>
                  <View style={styles.diffSettingTexts}>
                    <Text style={styles.diffSettingName}>{diff.name}</Text>
                    <Text style={styles.diffSettingDesc}>{diff.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Auto Play Cadence */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSecTitle}>和弦建立调性</Text>
              <Text style={styles.settingsSecDesc}>控制 I-IV-V-I 在训练中的自动播放频率</Text>
              <View style={styles.labelStyleGrid}>
                {(['every', 'first', 'manual'] as CadenceMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.labelStyleBtn,
                      settings.cadenceMode === mode && styles.labelStyleBtnActive,
                    ]}
                    onPress={() => updateCadenceModeSetting(mode)}
                  >
                    <Text style={[
                      styles.labelStyleBtnText,
                      settings.cadenceMode === mode && styles.labelStyleBtnTextActive,
                    ]}>
                      {CADENCE_MODE_LABELS[mode]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Daily Goal */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSecTitle}>每日训练目标</Text>
              <Text style={styles.settingsSecDesc}>影响首页进度条，不限制实际训练题数</Text>
              <View style={styles.labelStyleGrid}>
                {DAILY_GOAL_OPTIONS.map((goal) => (
                  <TouchableOpacity
                    key={goal}
                    style={[
                      styles.labelStyleBtn,
                      settings.dailyGoal === goal && styles.labelStyleBtnActive,
                    ]}
                    onPress={() => updateDailyGoalSetting(goal)}
                  >
                    <Text style={[
                      styles.labelStyleBtnText,
                      settings.dailyGoal === goal && styles.labelStyleBtnTextActive,
                    ]}>
                      {goal} 题
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Keyboard Label style inside settings */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSecTitle}>琴键标签默认展示</Text>
              <View style={styles.labelStyleGrid}>
                {(['degree', 'letter', 'both', 'none'] as const).map((style) => (
                  <TouchableOpacity
                    key={style}
                    style={[
                      styles.labelStyleBtn,
                      settings.showPianoLabels === style && styles.labelStyleBtnActive,
                    ]}
                    onPress={() => updateLabelSetting(style)}
                  >
                    <Text style={[
                      styles.labelStyleBtnText,
                      settings.showPianoLabels === style && styles.labelStyleBtnTextActive,
                    ]}>
                      {style === 'degree' && '首调简谱'}
                      {style === 'letter' && '音名字母'}
                      {style === 'both' && '简谱+音名'}
                      {style === 'none' && '不显示'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Data options */}
            <View style={[styles.settingsSection, { borderBottomWidth: 0 }]}>
              <Text style={styles.settingsSecTitle}>数据维护与重置</Text>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={clearStatsHistory}
              >
                <Text style={styles.resetButtonText}>🗑️ 清除所有训练数据与打卡天数</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        )}

      </Animated.View>

      {/* BOTTOM NAVIGATION TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'dashboard' && styles.tabItemActive]}
          onPress={() => handleTabChange('dashboard')}
        >
          <Text style={styles.tabIcon}>🔥</Text>
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>打卡主页</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'trainer' && styles.tabItemActive]}
          onPress={startTrainerSession}
        >
          <Text style={styles.tabIcon}>🎯</Text>
          <Text style={[styles.tabLabel, activeTab === 'trainer' && styles.tabLabelActive]}>音感训练</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'keyboard' && styles.tabItemActive]}
          onPress={() => handleTabChange('keyboard')}
        >
          <Text style={styles.tabIcon}>🎹</Text>
          <Text style={[styles.tabLabel, activeTab === 'keyboard' && styles.tabLabelActive]}>自由键盘</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => handleTabChange('settings')}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>个性设置</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Helper sandbox style updater
  function updateLabelStyleInSandbox(style: 'degree' | 'letter' | 'both' | 'none') {
    if (!settings) return;
    updateLabelSetting(style);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121214',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  headerSubtitle: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSettingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSettingIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  streakEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  streakInfo: {
    flex: 1,
  },
  streakCount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  streakLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 2,
  },
  bestStreakBadge: {
    backgroundColor: '#2E2E3A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bestStreakText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  todayProgressCard: {
    backgroundColor: '#1E1E24',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  cardSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  progressInner: {
    width: '100%',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  progressNum: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  progressPct: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#2D2D35',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 5,
  },
  todayStatsMini: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  mainStartButton: {
    backgroundColor: '#6366F1',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainStartButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  mainStartButtonSub: {
    color: '#E0E7FF',
    fontSize: 13,
    marginTop: 4,
    opacity: 0.9,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    marginTop: 8,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  modeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modeIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  modeTextContainer: {
    flex: 1,
  },
  modeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeDesc: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  statsSummaryCard: {
    backgroundColor: '#1E1E24',
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsGridItem: {
    alignItems: 'center',
    flex: 1,
  },
  statsGridNum: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statsGridLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },

  // Trainer Screen Styles
  trainerContainer: {
    flex: 1,
    backgroundColor: '#121214',
  },
  trainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E24',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#1E1E24',
  },
  backButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  trainerHeaderTitle: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  trainerTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  trainerLevelText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  trainerScoreBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#2E2E3A',
  },
  trainerScoreText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  trainerBody: {
    padding: 16,
    paddingBottom: 40,
  },
  trainerKeySelectorCard: {
    backgroundColor: '#1E1E24',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  keySelectorLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  keySelectorScroll: {
    paddingRight: 12,
  },
  keySelectorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#2D2D35',
    marginRight: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  keySelectorBadgeActive: {
    backgroundColor: '#6366F1',
  },
  keySelectorBadgeText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  keySelectorBadgeTextActive: {
    color: '#FFFFFF',
  },
  playpadCard: {
    backgroundColor: '#1E1E24',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
    alignItems: 'stretch',
  },
  playpadHelp: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  cadenceButton: {
    backgroundColor: '#1E1E28',
    borderColor: '#6366F1',
    borderWidth: 1.5,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  cadenceButtonPlaying: {
    backgroundColor: '#312E81',
    borderColor: '#818CF8',
  },
  cadenceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cadenceButtonSub: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  targetButton: {
    backgroundColor: '#6366F1',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  targetButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  targetButtonSub: {
    color: '#E0E7FF',
    fontSize: 11,
    marginTop: 4,
  },
  feedbackCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  feedbackCardCorrect: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  feedbackCardIncorrect: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  feedbackDesc: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  feedbackHighlight: {
    fontSize: 18,
    fontWeight: '900',
  },
  feedbackAnalysis: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  nextButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    color: '#121214',
    fontSize: 16,
    fontWeight: '800',
  },
  inputCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
    marginBottom: 16,
  },
  inputTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#2D2D35',
  },
  inputTab: {
    flex: 1,
    paddingBottom: 10,
    alignItems: 'center',
  },
  inputTabActive: {
    borderBottomWidth: 2,
    borderColor: '#6366F1',
  },
  inputTabText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  inputTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  degreeButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  degreeBtn: {
    width: '48%',
    backgroundColor: '#2D2D35',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  degreeBtnCorrect: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
  },
  degreeBtnIncorrect: {
    backgroundColor: '#7F1D1D',
    borderColor: '#EF4444',
  },
  degreeBtnDisabled: {
    opacity: 0.4,
  },
  degreeBtnText: {
    color: '#FFFFFF',
  },
  degreeBtnNum: {
    fontSize: 24,
    fontWeight: '900',
  },
  degreeBtnSolfege: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  trainerPianoWrapper: {
    width: '100%',
  },
  pianoInputHint: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },

  // Piano Interactive Element Styles
  pianoWrapper: {
    alignItems: 'center',
    marginVertical: 10,
  },
  pianoContainer: {
    height: 160,
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  whiteKeysContainer: {
    flexDirection: 'row',
    height: '100%',
    width: '100%',
  },
  whiteKey: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
  },
  whiteKeyActive: {
    backgroundColor: '#E5E7EB',
  },
  blackKey: {
    position: 'absolute',
    backgroundColor: '#1E1E24',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    zIndex: 10,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  blackKeyActive: {
    backgroundColor: '#374151',
  },
  keyHighlighted: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#D1FAE5',
  },
  keyLabelContainer: {
    alignItems: 'center',
    width: '100%',
  },
  pianoLabel: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 14,
  },
  pianoLabelBlack: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
  },
  pianoOctaveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
    paddingHorizontal: 4,
  },
  smallButton: {
    backgroundColor: '#2D2D35',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pianoOctaveText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Sandbox Sandbox Screen
  sandboxIntroCard: {
    backgroundColor: '#1E1E24',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  sandboxIntroTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  sandboxIntroText: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  sandboxConfigRow: {
    marginBottom: 12,
  },
  sandboxConfigCol: {
    backgroundColor: '#1E1E24',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  sandboxConfigLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  sandboxCadenceButton: {
    backgroundColor: '#1E1E24',
    borderColor: '#10B981',
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  sandboxCadenceText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  keyboardSandboxArea: {
    backgroundColor: '#1E1E24',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
    marginBottom: 16,
  },
  labelStyleCard: {
    backgroundColor: '#1E1E24',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  labelStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  labelStyleBtn: {
    width: '48%',
    backgroundColor: '#2D2D35',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  labelStyleBtnActive: {
    backgroundColor: '#6366F1',
  },
  labelStyleBtnText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  labelStyleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Settings screen styles
  settingsSection: {
    backgroundColor: '#1E1E24',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D35',
  },
  settingsSecTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  settingsSecDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 16,
  },
  settingsKeyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  settingsKeyBtn: {
    width: '22%',
    backgroundColor: '#2D2D35',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginRight: '3%',
    marginBottom: 10,
  },
  settingsKeyBtnActive: {
    backgroundColor: '#6366F1',
  },
  settingsKeyBtnText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
  },
  settingsKeyBtnTextActive: {
    color: '#FFFFFF',
  },
  diffSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#2D2D35',
  },
  diffSettingRowActive: {
    backgroundColor: '#22222E',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  diffSettingRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  diffSettingRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  diffSettingRadioInnerActive: {
    backgroundColor: '#6366F1',
  },
  diffSettingTexts: {
    flex: 1,
  },
  diffSettingName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  diffSettingDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleRowTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  toggleRowDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2D2D35',
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#10B981',
  },
  toggleSwitchHandle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleSwitchHandleOn: {
    transform: [{ translateX: 22 }],
  },
  resetButton: {
    backgroundColor: '#7F1D1D',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '700',
  },

  // Navigation Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#1E1E24',
    borderTopWidth: 1,
    borderTopColor: '#2D2D35',
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#6366F1',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#6366F1',
    fontWeight: '800',
  },
});


