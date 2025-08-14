import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  Share,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Sound from 'react-native-sound';
import Icon from 'react-native-vector-icons/Ionicons';
import { LineChart } from 'react-native-chart-kit';

// --- Game Settings Management ---
// Game color for the stimuli
const GAME_COLOR = '#4169e1'; // blue

// Game colors for color modality
const GAME_COLORS = ['#ff6347', '#4169e1', '#32cd32', '#ffd700', '#ff69b4', '#00ced1', '#ff8c00', '#9370db'];

// Game letters for audio stimuli
const GAME_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// Game shapes for shape modality
const GAME_SHAPES = ['square', 'circle', 'triangle', 'diamond'];

const DEFAULT_SETTINGS = {
  currentLevel: 2,
  gridSize: 3,
  trialDelay: 3, // seconds between trials
  gameTrials: 20, // number of trials per game
  matchProbability: 0.3, // 30% probability of matches
  winThreshold: 90, // percentage threshold for winning (default 90%)
  lossThreshold: 70, // percentage threshold for losing (default 70%)
  enablePosition: true, // enable position modality
  enableAudio: true, // enable audio modality
  enableColor: false, // disable color modality
  enableShape: false, // disable shape modality
};

const loadSettings = async () => {
  try {
    const savedSettings = await AsyncStorage.getItem('gameSettings');
    return savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
  } catch (error) {
    console.log('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem('gameSettings', JSON.stringify(settings));
  } catch (error) {
    console.log('Error saving settings:', error);
  }
};

// --- Stats Management ---
const STATS_STORAGE_KEY = 'gameStats';

const saveGameStats = async (gameStats) => {
  try {
    const existingStats = await loadGameStats();
    const updatedStats = [...existingStats, gameStats];
    await AsyncStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updatedStats));
  } catch (error) {
    console.log('Error saving game stats:', error);
  }
};

const loadGameStats = async () => {
  try {
    const stats = await AsyncStorage.getItem(STATS_STORAGE_KEY);
    return stats ? JSON.parse(stats) : [];
  } catch (error) {
    console.log('Error loading game stats:', error);
    return [];
  }
};

const clearGameStats = async () => {
  try {
    await AsyncStorage.removeItem(STATS_STORAGE_KEY);
  } catch (error) {
    console.log('Error clearing game stats:', error);
  }
};

// --- Backup and Restore Functions ---
const exportGameData = async () => {
  try {
    // Get current settings and stats
    const settings = await loadSettings();
    const stats = await loadGameStats();
    
    const gameData = {
      settings,
      stats,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataString = JSON.stringify(gameData, null, 2);
    
    // Share the data
    await Share.share({
      message: `N-Back Game Data Backup\n\n${dataString}`,
      title: 'nback-backup.json'
    });
    
    return true;
  } catch (error) {
    console.log('Error exporting game data:', error);
    Alert.alert('Export Failed', 'Failed to export game data. Please try again.');
    return false;
  }
};

const importGameData = async (dataString, onDataUpdate, onSettingsUpdate) => {
  try {
    // Extract JSON from the data string, ignoring any text headers
    let jsonData = dataString;
    
    // Look for JSON content starting with {
    const jsonStart = dataString.indexOf('{');
    if (jsonStart !== -1) {
      jsonData = dataString.substring(jsonStart);
    }
    
    // Try to find the end of the JSON (last })
    const jsonEnd = jsonData.lastIndexOf('}');
    if (jsonEnd !== -1) {
      jsonData = jsonData.substring(0, jsonEnd + 1);
    }
    
    const gameData = JSON.parse(jsonData);
    
    // Validate the data structure
    if (!gameData.settings || !gameData.stats || !gameData.exportDate) {
      throw new Error('Invalid backup data format');
    }
    
    // Restore settings
    await saveSettings(gameData.settings);
    
    // Restore stats
    await AsyncStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameData.stats));
    
    // Update the app's settings state
    if (onSettingsUpdate) {
      onSettingsUpdate(gameData.settings);
    }
    
    Alert.alert(
      'Import Successful', 
      `Successfully imported:\n• Settings\n• ${gameData.stats.length} game records\n\nBackup created: ${new Date(gameData.exportDate).toLocaleDateString()}`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (onDataUpdate) {
              onDataUpdate();
            }
          }
        }
      ]
    );
    
    return true;
  } catch (error) {
    console.log('Error importing game data:', error);
    Alert.alert('Import Failed', 'The backup data is invalid or corrupted. Please check the data and try again.');
    return false;
  }
};

// Import Modal Component
const ImportModal = ({ visible, onClose, onImport }) => {
  const [importData, setImportData] = useState('');

  const handleImport = () => {
    if (importData.trim()) {
      onImport(importData.trim());
      setImportData('');
      onClose();
    } else {
      Alert.alert('Import Failed', 'Please paste your backup data first.');
    }
  };

  const handlePaste = () => {
    // This would ideally use Clipboard API, but for now we'll just show instructions
    Alert.alert(
      'Paste Instructions',
      '1. Copy your backup data\n2. Long press in the text area\n3. Select "Paste" from the menu\n\nOr simply type/paste your backup data in the text area below.'
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Import Game Data</Text>
        <Text style={styles.modalSubtitle}>
          Paste your backup data below. The import will automatically extract the JSON data.
        </Text>
        
        <View style={styles.importInputContainer}>
          <TextInput
            style={styles.importTextInput}
            multiline
            placeholder="Paste your backup data here... (including any text headers)"
            value={importData}
            onChangeText={setImportData}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
            scrollEnabled={true}
          />
          <TouchableOpacity style={styles.pasteHelpButton} onPress={handlePaste}>
            <Text style={styles.pasteHelpButtonText}>📋 Paste Help</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalImportButton} onPress={handleImport}>
            <Text style={styles.modalImportButtonText}>Import</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </Modal>
  );
};

// --- Helper Components ---
const TabIcon = ({ name, focused }) => {
  let iconName;

  switch (name) {
    case 'Play':
      iconName = focused ? 'play-circle' : 'play-circle-outline';
      break;
    case 'Help':
      iconName = focused ? 'help-circle' : 'help-circle-outline';
      break;
    case 'Stats':
      iconName = focused ? 'bar-chart' : 'bar-chart-outline';
      break;
    case 'Settings':
      iconName = focused ? 'settings' : 'settings-outline';
      break;
    default:
      iconName = 'help-circle-outline';
  }

  return (
    <Icon
      name={iconName}
      size={24}
      color={focused ? '#1e90ff' : '#888'}
    />
  );
};

// --- Screen Components ---

// Start Screen
const StartScreen = ({ settings, onStartGame }) => {
  const handleStartGame = () => {
    onStartGame(settings);
  };

  const getModalityText = () => {
    const modalities = [];
    if (settings.enablePosition) modalities.push('Position');
    if (settings.enableAudio) modalities.push('Audio');
    if (settings.enableColor) modalities.push('Color');
    if (settings.enableShape) modalities.push('Shape');
    
    if (modalities.length === 0) {
      return 'No Modalities Enabled';
    } else if (modalities.length === 1) {
      return `${modalities[0]} Only`;
    } else {
      return modalities.join(' + ');
    }
  };

  return (
    <View style={styles.startScreenContainer}>
      <Text style={styles.headerText}>Current Level: {settings.currentLevel}-Back</Text>
      <Text style={styles.bodyText}>Grid Size: {settings.gridSize}x{settings.gridSize}</Text>
      <Text style={styles.bodyText}>Modalities: {getModalityText()}</Text>
      <TouchableOpacity 
        style={[styles.startButton, (!settings.enablePosition && !settings.enableAudio && !settings.enableColor && !settings.enableShape) && styles.disabledButton]} 
        onPress={handleStartGame}
        disabled={!settings.enablePosition && !settings.enableAudio && !settings.enableColor && !settings.enableShape}
      >
        <Text style={styles.buttonText}>Start Game</Text>
      </TouchableOpacity>
    </View>
  );
};

// Instructions Screen
const InstructionsScreen = () => (
  <ScrollView
    style={styles.screenContainer}
    contentContainerStyle={styles.instructionsContentContainer}
    showsVerticalScrollIndicator={false}
  >
    <Text style={styles.headerText}>How to Play</Text>

    <View style={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>What is the N-Back Task?</Text>
      <Text style={styles.instructionsText}>
        The N-Back task is a cognitive training exercise that tests your working memory and attention.
        You'll need to remember stimuli from "N" trials ago and respond when you see/hear a match.
      </Text>

      <Text style={styles.instructionsTitle}>Game Setup</Text>
      <Text style={styles.instructionsText}>
        • A colored square appears in a grid position (if position modality is enabled){'\n'}
        • A letter is spoken aloud (if audio modality is enabled){'\n'}
        • The square changes color (if color modality is enabled){'\n'}
        • The square changes shape (if shape modality is enabled){'\n'}
        • All happen simultaneously every few seconds{'\n'}
        • You must remember the position, letter, color, and shape
      </Text>

      <Text style={styles.instructionsTitle}>Modalities</Text>
      <Text style={styles.instructionsText}>
        You can play with different combinations of modalities:{'\n'}
        • Position only: Remember and match grid positions{'\n'}
        • Audio only: Remember and match spoken letters{'\n'}
        • Color only: Remember and match square colors{'\n'}
        • Shape only: Remember and match square shapes{'\n'}
        • Any combination: Remember and match multiple types{'\n'}
        • Change these in Settings
      </Text>

      <Text style={styles.instructionsTitle}>How to Respond</Text>
      <Text style={styles.instructionsText}>
        • Press "Position" if the square appears in the SAME position as N trials ago{'\n'}
        • Press "Audio" if you hear the SAME letter as N trials ago{'\n'}
        • Press "Color" if the square is the SAME color as N trials ago{'\n'}
        • Press "Shape" if the square is the SAME shape as N trials ago{'\n'}
        • You can press multiple buttons if multiple types match{'\n'}
        • Don't press anything if none match{'\n'}
        • Only enabled modality buttons will be shown
      </Text>

      <Text style={styles.instructionsTitle}>Tips</Text>
      <Text style={styles.instructionsText}>
        • Start with lower N values (1-3) to get comfortable{'\n'}
        • Try single modality first to focus on one type of memory{'\n'}
        • Don't worry about mistakes - this is challenging for everyone!{'\n'}
        • Regular practice can improve your working memory
      </Text>
    </View>
  </ScrollView>
);

// Statistics Screen
const StatisticsScreen = ({ refreshTrigger, currentSettings }) => {
  const [gameStats, setGameStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLast7Days, setShowLast7Days] = useState(false);

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const stats = await loadGameStats();
      setGameStats(stats);
    } catch (error) {
      console.log('Error loading stats:', error);
      setGameStats([]);
    }
    setLoading(false);
  };

  const clearStats = async () => {
    await clearGameStats();
    setGameStats([]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getModalityText = (stat) => {
    const modalities = [];
    if (stat.enablePosition) modalities.push('Position');
    if (stat.enableAudio) modalities.push('Audio');
    if (stat.enableColor) modalities.push('Color');
    if (stat.enableShape) modalities.push('Shape');
    
    if (modalities.length === 0) {
      return 'Unknown';
    } else if (modalities.length === 1) {
      return `${modalities[0]} Only`;
    } else {
      return modalities.join(' + ');
    }
  };

  // Filter stats to only show games with matching modality settings
  const getFilteredStats = () => {
    if (!currentSettings) return gameStats;
    
    return gameStats.filter(stat => 
      stat.enablePosition === currentSettings.enablePosition && 
      stat.enableAudio === currentSettings.enableAudio &&
      stat.enableColor === currentSettings.enableColor &&
      stat.enableShape === currentSettings.enableShape
    );
  };

  const prepareChartData = () => {
    const filteredStats = getFilteredStats();
    if (filteredStats.length === 0) return null;

    // Filter stats by date if needed
    let dateFilteredStats = filteredStats;
    if (showLast7Days) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilteredStats = filteredStats.filter(stat => new Date(stat.date) >= sevenDaysAgo);
    }

    // Sort stats by date
    const sortedStats = [...dateFilteredStats].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get unique dates and calculate averages and maxes
    const dateMap = new Map();

    sortedStats.forEach(stat => {
      const date = formatDate(stat.date);
      if (!dateMap.has(date)) {
        dateMap.set(date, { difficulties: [], accuracies: [] });
      }
      dateMap.get(date).difficulties.push(stat.difficulty);
      dateMap.get(date).accuracies.push(stat.accuracy);
    });

    const dates = Array.from(dateMap.keys());
    const avgDifficulties = dates.map(date => {
      const difficulties = dateMap.get(date).difficulties;
      return difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;
    });
    const maxDifficulties = dates.map(date => {
      const difficulties = dateMap.get(date).difficulties;
      return Math.max(...difficulties);
    });

    return {
      labels: dates,
      datasets: [
        {
          data: avgDifficulties,
          color: (opacity = 1) => `rgba(30, 144, 255, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: maxDifficulties,
          color: (opacity = 1) => `rgba(255, 99, 71, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const prepareAccuracyChartData = () => {
    const filteredStats = getFilteredStats();
    if (filteredStats.length === 0) return null;

    // Filter stats by date if needed
    let dateFilteredStats = filteredStats;
    if (showLast7Days) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilteredStats = filteredStats.filter(stat => new Date(stat.date) >= sevenDaysAgo);
    }

    // Sort stats by date
    const sortedStats = [...dateFilteredStats].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get unique dates and calculate average accuracies
    const dateMap = new Map();

    sortedStats.forEach(stat => {
      const date = formatDate(stat.date);
      if (!dateMap.has(date)) {
        dateMap.set(date, { accuracies: [] });
      }
      dateMap.get(date).accuracies.push(stat.accuracy);
    });

    const dates = Array.from(dateMap.keys());
    const avgAccuracies = dates.map(date => {
      const accuracies = dateMap.get(date).accuracies;
      return accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
    });

    return {
      labels: dates,
      datasets: [
        {
          data: avgAccuracies,
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const chartData = prepareChartData();
  const accuracyChartData = prepareAccuracyChartData();
  const screenWidth = Dimensions.get('window').width;

  // Calculate global maximum difficulty for consistent y-axis scaling
  const filteredStats = getFilteredStats();
  const globalMaxDifficulty = filteredStats.length > 0 ? Math.max(...filteredStats.map(stat => stat.difficulty)) : 1;

  if (loading) {
    return (
      <View style={styles.screenContainer}>
        <Text style={styles.headerText}>Loading Statistics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.statsScreenContainer}
      contentContainerStyle={styles.statsScreenContentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsHeader}>
        <Text style={styles.headerText}>Your Progress</Text>
        {currentSettings && (
          <Text style={styles.modalityInfo}>
            {getModalityText(currentSettings)} Mode
          </Text>
        )}
      </View>

      {filteredStats.length === 0 ? (
        <View style={styles.emptyStatsContainer}>
          <Text style={styles.emptyStatsText}>No games played with current modality settings!</Text>
          <Text style={styles.emptyStatsSubtext}>
            {currentSettings ? 
              `Play some games with ${getModalityText(currentSettings)} mode to see your progress here.` :
              'Play some games to see your progress here.'
            }
          </Text>
        </View>
      ) : (
        <>
          {/* Summary Stats */}
          <View style={styles.summaryContainer}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>{filteredStats.length}</Text>
                <Text style={styles.summaryLabel}>Games Played</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {Math.max(...filteredStats.map(s => s.difficulty))}
                </Text>
                <Text style={styles.summaryLabel}>Highest Level</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {(filteredStats.reduce((sum, s) => sum + s.accuracy, 0) / filteredStats.length).toFixed(1)}%
                </Text>
                <Text style={styles.summaryLabel}>Avg Accuracy</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryNumber}>
                  {Math.max(...filteredStats.map(s => s.accuracy)).toFixed(1)}%
                </Text>
                <Text style={styles.summaryLabel}>Best Accuracy</Text>
              </View>
            </View>
          </View>

          {/* Charts */}
          {chartData && (
            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                <Text style={styles.sectionTitle}>Difficulty Over Time</Text>
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    showLast7Days && styles.filterButtonActive
                  ]}
                  onPress={() => setShowLast7Days(!showLast7Days)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    showLast7Days && styles.filterButtonTextActive
                  ]}>
                    {showLast7Days ? 'Last 7 Days' : 'All Time'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.chartSubtitle}>
                Average (blue) and Maximum (red) difficulty levels
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartScrollContainer}
              >
                <LineChart
                  data={chartData} // Ensure this object contains your precise decimal values
                  width={Math.max(screenWidth - 60, chartData.labels.length * 80)}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#ffffff',
                    backgroundGradientFrom: '#ffffff',
                    backgroundGradientTo: '#ffffff',
                    // REMOVED: decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#1e90ff',
                    },
                    // This function correctly formats the Y-axis labels as integers
                    formatYLabel: (yLabel) => Math.round(parseFloat(yLabel)).toString(),
                  }}
                  bezier
                  style={styles.chart}
                  fromZero={false}
                  yAxisMin={1}
                  yAxisMax={globalMaxDifficulty + 1}
                />
              </ScrollView>
            </View>
          )}

          {/* Recent Games */}
          <View style={styles.recentGamesContainer}>
            <Text style={styles.sectionTitle}>Recent Games</Text>
            {filteredStats.slice(-10).reverse().map((stat, index) => (
              <View key={index} style={styles.gameStatItem}>
                <View style={styles.gameStatHeader}>
                  <Text style={styles.gameStatDate}>{formatDate(stat.date)}</Text>
                  <Text style={styles.gameStatDifficulty}>{stat.difficulty}-Back</Text>
                </View>
                <View style={styles.gameStatDetails}>
                  <Text style={styles.gameStatAccuracy}>
                    Accuracy: {stat.accuracy.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.gameStatResult}>
                  <Text style={styles.gameStatResultText}>
                    {stat.accuracy >= 90 ? '🎉 Win' : stat.accuracy <= 70 ? '😔 Loss' : '⚖️ Neutral'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Clear Stats Button */}
          <TouchableOpacity style={styles.clearStatsButton} onPress={clearStats}>
            <Text style={styles.clearStatsButtonText}>Clear All Statistics</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

// Settings Screen
const SettingsScreen = ({ settings, onSettingsChange, onDataUpdate }) => {
  const [showImportModal, setShowImportModal] = useState(false);

  const updateSetting = async (key, value) => {
    let newSettings = { ...settings, [key]: value };

    // // If current level is being changed, ensure game length is at least equal to it
    // if (key === 'currentLevel' && newSettings.gameLength + newSettings.currentLevel < value) {
    //   newSettings = { ...newSettings, gameLength: value };
    // }

    // Prevent disabling both modalities
    if (key === 'enablePosition' && !value && !newSettings.enableAudio && !newSettings.enableColor && !newSettings.enableShape) {
      Alert.alert('Invalid Setting', 'At least one modality must be enabled.');
      return;
    }
    if (key === 'enableAudio' && !value && !newSettings.enablePosition && !newSettings.enableColor && !newSettings.enableShape) {
      Alert.alert('Invalid Setting', 'At least one modality must be enabled.');
      return;
    }
    if (key === 'enableColor' && !value && !newSettings.enablePosition && !newSettings.enableAudio && !newSettings.enableShape) {
      Alert.alert('Invalid Setting', 'At least one modality must be enabled.');
      return;
    }
    if (key === 'enableShape' && !value && !newSettings.enablePosition && !newSettings.enableAudio && !newSettings.enableColor) {
      Alert.alert('Invalid Setting', 'At least one modality must be enabled.');
      return;
    }

    onSettingsChange(newSettings);
    await saveSettings(newSettings);
  };

  return (
    <ScrollView
      style={styles.settingsScreenContainer}
      contentContainerStyle={styles.settingsScreenContentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerText}>Settings</Text>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Current Level: {settings.currentLevel}-Back</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('currentLevel', Math.max(1, settings.currentLevel - 1))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('currentLevel', Math.min(8, settings.currentLevel + 1))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Grid Size: {settings.gridSize}x{settings.gridSize}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('gridSize', Math.max(2, settings.gridSize - 1))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('gridSize', Math.min(5, settings.gridSize + 1))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Trial Delay: {settings.trialDelay}s</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('trialDelay', Math.max(1, settings.trialDelay - 0.5))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('trialDelay', Math.min(10, settings.trialDelay + 0.5))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Number of Trials: {settings.gameTrials} trials</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('gameTrials', Math.max(0, settings.gameTrials - 1))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('gameTrials', Math.min(999, settings.gameTrials + 1))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Match Probability: {(settings.matchProbability * 100).toFixed(0)}%</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('matchProbability', Math.max(0.1, settings.matchProbability - 0.1))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('matchProbability', Math.min(0.9, settings.matchProbability + 0.1))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Win Threshold: {settings.winThreshold}%</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('winThreshold', Math.max(settings.lossThreshold + 10, settings.winThreshold - 5))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('winThreshold', Math.min(100, settings.winThreshold + 5))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Loss Threshold: {settings.lossThreshold}%</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('lossThreshold', Math.max(0, settings.lossThreshold - 5))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => updateSetting('lossThreshold', Math.min(settings.winThreshold - 10, settings.lossThreshold + 5))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modality Settings */}
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Position Modality: {settings.enablePosition ? 'ON' : 'OFF'}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, settings.enablePosition && styles.toggleButtonActive]}
          onPress={() => updateSetting('enablePosition', !settings.enablePosition)}
        >
          <Text style={[styles.toggleButtonText, settings.enablePosition && styles.toggleButtonTextActive]}>
            {settings.enablePosition ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Audio Modality: {settings.enableAudio ? 'ON' : 'OFF'}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, settings.enableAudio && styles.toggleButtonActive]}
          onPress={() => updateSetting('enableAudio', !settings.enableAudio)}
        >
          <Text style={[styles.toggleButtonText, settings.enableAudio && styles.toggleButtonTextActive]}>
            {settings.enableAudio ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Color Modality: {settings.enableColor ? 'ON' : 'OFF'}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, settings.enableColor && styles.toggleButtonActive]}
          onPress={() => updateSetting('enableColor', !settings.enableColor)}
        >
          <Text style={[styles.toggleButtonText, settings.enableColor && styles.toggleButtonTextActive]}>
            {settings.enableColor ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>Shape Modality: {settings.enableShape ? 'ON' : 'OFF'}</Text>
        <TouchableOpacity
          style={[styles.toggleButton, settings.enableShape && styles.toggleButtonActive]}
          onPress={() => updateSetting('enableShape', !settings.enableShape)}
        >
          <Text style={[styles.toggleButtonText, settings.enableShape && styles.toggleButtonTextActive]}>
            {settings.enableShape ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Warning if both modalities are disabled */}
      {!settings.enablePosition && !settings.enableAudio && !settings.enableColor && !settings.enableShape && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>⚠️ At least one modality must be enabled!</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.resetButton}
        onPress={async () => {
          onSettingsChange(DEFAULT_SETTINGS);
          await saveSettings(DEFAULT_SETTINGS);
        }}
      >
        <Text style={styles.resetButtonText}>Reset to Defaults</Text>
      </TouchableOpacity>

      {/* Backup and Restore Section */}
      <View style={styles.backupSection}>
        <Text style={styles.sectionTitle}>Backup & Restore</Text>
        
        <TouchableOpacity
          style={styles.backupButton}
          onPress={async () => {
            const success = await exportGameData();
            if (success && onDataUpdate) {
              onDataUpdate();
            }
          }}
        >
          <Text style={styles.backupButtonText}>📤 Export Game Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={() => setShowImportModal(true)}
        >
          <Text style={styles.restoreButtonText}>📥 Import Game Data</Text>
        </TouchableOpacity>
      </View>

      <ImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={(dataString) => importGameData(dataString, onDataUpdate, onSettingsChange)}
      />
    </ScrollView>
  );
};

// Shape View Component
const ShapeView = ({ shape, color, size }) => {
  const shapeStyle = {
    width: size,
    height: size,
    backgroundColor: color || GAME_COLOR,
  };

  switch (shape) {
    case 'circle':
      return (
        <View style={[shapeStyle, { borderRadius: size / 2 }]} />
      );
    case 'triangle':
      return (
        <View style={[shapeStyle, { 
          backgroundColor: 'transparent',
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderBottomWidth: size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color || GAME_COLOR,
        }]} />
      );
    case 'diamond':
      return (
        <View style={[shapeStyle, { 
          transform: [{ rotate: '45deg' }],
          width: size * 0.7, // Make diamond smaller to fit within grid
          height: size * 0.7,
        }]} />
      );
    case 'square':
    default:
      return <View style={shapeStyle} />;
  }
};

// Game Grid Component
const GameGrid = ({ gridSize, activeCell, anyButtonPressed, positionEnabled = true }) => {
  const totalCells = gridSize * gridSize;
  const gridSize_px = 300;
  const cellSize = gridSize_px / gridSize;

  // Create animated value for the active cell
  const activeCellAnimation = useRef(new Animated.Value(0)).current;
  const lastPosition = useRef(null);

  // Animate the active cell when it changes
  useEffect(() => {
    if (activeCell && !anyButtonPressed) {
      const currentPosition = positionEnabled ? activeCell.position : 0;
      
      // Always animate when a new trial occurs, regardless of position change
      if (positionEnabled) {
        // Reset animation
        activeCellAnimation.setValue(0);

        // Animate the active cell
        Animated.timing(activeCellAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start();
      } else {
        // When position is disabled, just set to final state without animation
        activeCellAnimation.setValue(1);
      }
      
      lastPosition.current = currentPosition;
    }
  }, [activeCell, anyButtonPressed, positionEnabled]);

  return (
    <View style={[styles.gameGrid, { width: gridSize_px, height: gridSize_px }]}>
      {/* Background grid */}
      {Array.from({ length: gridSize }).map((_, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {Array.from({ length: gridSize }).map((_, colIndex) => (
            <View
              key={`bg-${rowIndex}-${colIndex}`}
              style={[
                styles.gridCell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: '#f8f8f8'
                }
              ]}
            />
          ))}
        </View>
      ))}

      {/* Animated active cell overlay */}
      {activeCell && (
        <Animated.View
          style={[
            styles.activeCellOverlay,
            {
              position: 'absolute',
              left: positionEnabled ? (activeCell.position % gridSize) * cellSize : 0,
              top: positionEnabled ? Math.floor(activeCell.position / gridSize) * cellSize : 0,
              width: cellSize,
              height: cellSize,
              backgroundColor: activeCell.shape ? 'transparent' : (activeCell.color || GAME_COLOR),
              justifyContent: 'center',
              alignItems: 'center',
              opacity: anyButtonPressed ? 1 : activeCellAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
              transform: [{
                scale: anyButtonPressed ? 1 : activeCellAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                })
              }]
            }
          ]}
        >
          {activeCell.shape && (
            <ShapeView 
              shape={activeCell.shape} 
              color={activeCell.color || GAME_COLOR} 
              size={cellSize * 0.8} 
            />
          )}
        </Animated.View>
      )}
    </View>
  );
};

// Game Mode Screen
const GameMode = ({ settings, onExitGame, onSettingsChange }) => {
  const [activeCell, setActiveCell] = useState(null);
  const [trialCount, setTrialCount] = useState(0);
  const [gameHistory, setGameHistory] = useState([]);
  const [isGameActive, setIsGameActive] = useState(true);



  // N-back scoring variables
  const [positionTP, setTruePositives] = useState(0);
  const [positionFP, setFalsePositives] = useState(0);
  const [positionTN, setTrueNegatives] = useState(0);
  const [positionFN, setFalseNegatives] = useState(0);
  const [userResponses, setUserResponses] = useState([]);

  // Audio scoring variables
  const [audioTP, setAudioTruePositives] = useState(0);
  const [audioFP, setAudioFalsePositives] = useState(0);
  const [audioTN, setAudioTrueNegatives] = useState(0);
  const [audioFN, setAudioFalseNegatives] = useState(0);
  const [audioUserResponses, setAudioUserResponses] = useState([]);

  // Color scoring variables
  const [colorTP, setColorTruePositives] = useState(0);
  const [colorFP, setColorFalsePositives] = useState(0);
  const [colorTN, setColorTrueNegatives] = useState(0);
  const [colorFN, setColorFalseNegatives] = useState(0);
  const [colorUserResponses, setColorUserResponses] = useState([]);

  // Shape scoring variables
  const [shapeTP, setShapeTruePositives] = useState(0);
  const [shapeFP, setShapeFalsePositives] = useState(0);
  const [shapeTN, setShapeTrueNegatives] = useState(0);
  const [shapeFN, setShapeFalseNegatives] = useState(0);
  const [shapeUserResponses, setShapeUserResponses] = useState([]);

  // Button press states
  const [positionButtonPressed, setPositionButtonPressed] = useState(false);
  const [audioButtonPressed, setAudioButtonPressed] = useState(false);
  const [colorButtonPressed, setColorButtonPressed] = useState(false);
  const [shapeButtonPressed, setShapeButtonPressed] = useState(false);
  const [anyButtonPressed, setAnyButtonPressed] = useState(false);

  // Audio state
  const [currentLetter, setCurrentLetter] = useState(null);
  const [audioSounds, setAudioSounds] = useState({});

  // Initialize audio sounds
  const [audioSoundsLoaded, setAudioSoundsLoaded] = useState(false);

  // Stats display state
  const [showStats, setShowStats] = useState(false);

  // Track if level change has been processed
  const levelChangeProcessed = useRef(false);
  
  // Track the next level for display
  const [nextLevel, setNextLevel] = useState(null);

  useEffect(() => {
    const loadAudioSounds = () => {
      const sounds = {};
      let loadedCount = 0;

      // Enable playback in silence mode
      Sound.setCategory('Playback');

      GAME_LETTERS.forEach(letter => {
        // Load sounds from raw directory (without file extension)
        const sound = new Sound(letter.toLowerCase(), Sound.MAIN_BUNDLE, (error) => {
          if (error) {
            console.log(`Failed to load sound for letter ${letter}:`, error);
          } else {
            loadedCount++;
            if (loadedCount === GAME_LETTERS.length) {
              setAudioSoundsLoaded(true);
            }
          }
        });
        sounds[letter] = sound;
      });
      setAudioSounds(sounds);
    };

    loadAudioSounds();

    // Cleanup sounds when component unmounts
    return () => {
      Object.values(audioSounds).forEach(sound => {
        if (sound) {
          sound.release();
        }
      });
    };
  }, []);

  // Effect to handle trial progression
  useEffect(() => {
    if (!isGameActive || !audioSoundsLoaded) {
      return;
    }

    const interval = setInterval(() => {
      setTrialCount(prev => {
        const newCount = prev + 1;

        if (newCount > settings.gameTrials + settings.currentLevel) {
          setIsGameActive(false);
          return prev;
        }

        let newPosition;
        let newLetter;
        let newColor;
        let newShape;

        setGameHistory(prev => {
          let newPosition;
          let newLetter;
          let newColor;
          let newShape;

          if (newCount <= settings.currentLevel) {
            // First n trials: uniform random
            newPosition = settings.enablePosition ? Math.floor(Math.random() * (settings.gridSize * settings.gridSize)) : null;
            newLetter = settings.enableAudio ? GAME_LETTERS[Math.floor(Math.random() * GAME_LETTERS.length)] : null;
            newColor = settings.enableColor ? GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)] : null;
            newShape = settings.enableShape ? GAME_SHAPES[Math.floor(Math.random() * GAME_SHAPES.length)] : null;
          } else {
            // Subsequent trials: controlled probability
            const random = Math.random();
            const letterRandom = Math.random();
            const colorRandom = Math.random();
            const shapeRandom = Math.random();

            // Position generation with controlled probability
            if (settings.enablePosition) {
              const nBackStimulus = prev[newCount - settings.currentLevel - 1];
              if (random < settings.matchProbability) {
                // With probability p, select the same position as n trials ago
                newPosition = nBackStimulus.position;
              } else {
                // With probability 1-p, select uniform random position that is NOT the n-back position
                const totalPositions = settings.gridSize * settings.gridSize;
                let randomPosition;
                do {
                  randomPosition = Math.floor(Math.random() * totalPositions);
                } while (randomPosition === nBackStimulus.position);
                newPosition = randomPosition;
              }
            } else {
              newPosition = null;
            }

            // Letter generation with controlled probability
            if (settings.enableAudio) {
              const nBackStimulus = prev[newCount - settings.currentLevel - 1];
              if (letterRandom < settings.matchProbability) {
                // With probability p, select the same letter as n trials ago
                newLetter = nBackStimulus.letter;
              } else {
                // With probability 1-p, select uniform random letter that is NOT the n-back letter
                let randomLetter;
                do {
                  randomLetter = GAME_LETTERS[Math.floor(Math.random() * GAME_LETTERS.length)];
                } while (randomLetter === nBackStimulus.letter);
                newLetter = randomLetter;
              }
            } else {
              newLetter = null;
            }

            // Color generation with controlled probability
            if (settings.enableColor) {
              const nBackStimulus = prev[newCount - settings.currentLevel - 1];
              if (colorRandom < settings.matchProbability) {
                // With probability p, select the same color as n trials ago
                newColor = nBackStimulus.color;
              } else {
                // With probability 1-p, select uniform random color that is NOT the n-back color
                let randomColor;
                do {
                  randomColor = GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)];
                } while (randomColor === nBackStimulus.color);
                newColor = randomColor;
              }
            } else {
              newColor = null;
            }

            // Shape generation with controlled probability
            if (settings.enableShape) {
              const nBackStimulus = prev[newCount - settings.currentLevel - 1];
              if (shapeRandom < settings.matchProbability) {
                // With probability p, select the same shape as n trials ago
                newShape = nBackStimulus.shape;
              } else {
                // With probability 1-p, select uniform random shape that is NOT the n-back shape
                let randomShape;
                do {
                  randomShape = GAME_SHAPES[Math.floor(Math.random() * GAME_SHAPES.length)];
                } while (randomShape === nBackStimulus.shape);
                newShape = randomShape;
              }
            } else {
              newShape = null;
            }
          }

          const newStimulus = {
            position: newPosition,
            color: newColor,
            letter: newLetter,
            shape: newShape,
            trialNumber: newCount
          };

          setActiveCell(newStimulus);
          setCurrentLetter(newLetter);

          // Play the letter sound only if audio is enabled
          if (settings.enableAudio && newLetter) {
            playLetterSound(newLetter);
          }

          return [...prev, newStimulus];
        });

        // Play the letter sound only if audio is enabled
        if (settings.enableAudio && newLetter) {
          playLetterSound(newLetter);
        }

        return newCount;
      });
    }, settings.trialDelay * 1000);

    return () => clearInterval(interval);
  }, [isGameActive, audioSoundsLoaded, settings.trialDelay, settings.gridSize, settings.gameTrials, settings.currentLevel, settings.matchProbability]);

  // Reset button states when trial count changes
  useEffect(() => {
    if (trialCount > 0) {
      setPositionButtonPressed(false);
      setAudioButtonPressed(false);
      setColorButtonPressed(false);
      setShapeButtonPressed(false);
      setAnyButtonPressed(false);
    }
  }, [trialCount]);

  const handlePositionMatch = () => {
    if (trialCount <= settings.currentLevel) return; // Can't match until we have enough trials

    const currentStimulus = gameHistory[trialCount - 1];
    const nBackStimulus = gameHistory[trialCount - 1 - settings.currentLevel];
    const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.position === nBackStimulus.position;

    // Record user response (they pressed the button)
    const response = {
      trialNumber: trialCount,
      userPressed: true,
      wasActuallyMatch: isActuallyMatch
    };
    console.log('Position match pressed - Trial:', trialCount, 'Actually match:', isActuallyMatch);
    setUserResponses(prev => [...prev, response]);
    setPositionButtonPressed(true);
    setAnyButtonPressed(true);
  };

  const handleAudioMatch = () => {
    if (trialCount <= settings.currentLevel) return; // Can't match until we have enough trials

    const currentStimulus = gameHistory[trialCount - 1];
    const nBackStimulus = gameHistory[trialCount - 1 - settings.currentLevel];
    const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.letter === nBackStimulus.letter;

    // Record user response (they pressed the button)
    const response = {
      trialNumber: trialCount,
      userPressed: true,
      wasActuallyMatch: isActuallyMatch
    };
    console.log('Audio match pressed - Trial:', trialCount, 'Actually match:', isActuallyMatch);
    setAudioUserResponses(prev => [...prev, response]);
    setAudioButtonPressed(true);
    setAnyButtonPressed(true);
  };

  const handleColorMatch = () => {
    if (trialCount <= settings.currentLevel) return; // Can't match until we have enough trials

    const currentStimulus = gameHistory[trialCount - 1];
    const nBackStimulus = gameHistory[trialCount - 1 - settings.currentLevel];
    const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.color === nBackStimulus.color;

    // Record user response (they pressed the button)
    const response = {
      trialNumber: trialCount,
      userPressed: true,
      wasActuallyMatch: isActuallyMatch
    };
    console.log('Color match pressed - Trial:', trialCount, 'Actually match:', isActuallyMatch);
    setColorUserResponses(prev => [...prev, response]);
    setColorButtonPressed(true);
    setAnyButtonPressed(true);
  };

  const handleShapeMatch = () => {
    if (trialCount <= settings.currentLevel) return; // Can't match until we have enough trials

    const currentStimulus = gameHistory[trialCount - 1];
    const nBackStimulus = gameHistory[trialCount - 1 - settings.currentLevel];
    const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.shape === nBackStimulus.shape;

    // Record user response (they pressed the button)
    const response = {
      trialNumber: trialCount,
      userPressed: true,
      wasActuallyMatch: isActuallyMatch
    };
    console.log('Shape match pressed - Trial:', trialCount, 'Actually match:', isActuallyMatch);
    setShapeUserResponses(prev => [...prev, response]);
    setShapeButtonPressed(true);
    setAnyButtonPressed(true);
  };

  // Calculate final scores when game ends
  useEffect(() => {
    if (!isGameActive && gameHistory.length > 0 && !levelChangeProcessed.current) {
      // Calculate scores first (before resetting)
      let tempPositionTP = 0, tempPositionFP = 0, tempPositionTN = 0, tempPositionFN = 0;
      let tempAudioTP = 0, tempAudioFP = 0, tempAudioTN = 0, tempAudioFN = 0;
      let tempColorTP = 0, tempColorFP = 0, tempColorTN = 0, tempColorFN = 0;
      let tempShapeTP = 0, tempShapeFP = 0, tempShapeTN = 0, tempShapeFN = 0;

      // Calculate position scores for all trials where matching is possible (only if position is enabled)
      if (settings.enablePosition) {
        console.log('Position responses:', userResponses);
        for (let i = settings.currentLevel; i < gameHistory.length; i++) {
          const currentStimulus = gameHistory[i];
          const nBackStimulus = gameHistory[i - settings.currentLevel];
          const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.position === nBackStimulus.position;

          const userResponded = userResponses.some(response => response.trialNumber === i + 1);

          if (isActuallyMatch && userResponded) {
            tempPositionTP++;
          } else if (isActuallyMatch && !userResponded) {
            tempPositionFN++;
          } else if (!isActuallyMatch && userResponded) {
            tempPositionFP++;
          } else if (!isActuallyMatch && !userResponded) {
            tempPositionTN++;
          }
        }
      }

      // Calculate audio scores for all trials where matching is possible (only if audio is enabled)
      if (settings.enableAudio) {
        console.log('Audio responses:', audioUserResponses);
        for (let i = settings.currentLevel; i < gameHistory.length; i++) {
          const currentStimulus = gameHistory[i];
          const nBackStimulus = gameHistory[i - settings.currentLevel];
          const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.letter === nBackStimulus.letter;

          const userResponded = audioUserResponses.some(response => response.trialNumber === i + 1);

          if (isActuallyMatch && userResponded) {
            tempAudioTP++;
          } else if (isActuallyMatch && !userResponded) {
            tempAudioFN++;
          } else if (!isActuallyMatch && userResponded) {
            tempAudioFP++;
          } else if (!isActuallyMatch && !userResponded) {
            tempAudioTN++;
          }
        }
      }

      // Calculate color scores for all trials where matching is possible (only if color is enabled)
      if (settings.enableColor) {
        console.log('Color responses:', colorUserResponses);
        for (let i = settings.currentLevel; i < gameHistory.length; i++) {
          const currentStimulus = gameHistory[i];
          const nBackStimulus = gameHistory[i - settings.currentLevel];
          const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.color === nBackStimulus.color;

          const userResponded = colorUserResponses.some(response => response.trialNumber === i + 1);

          if (isActuallyMatch && userResponded) {
            tempColorTP++;
          } else if (isActuallyMatch && !userResponded) {
            tempColorFN++;
          } else if (!isActuallyMatch && userResponded) {
            tempColorFP++;
          } else if (!isActuallyMatch && !userResponded) {
            tempColorTN++;
          }
        }
      }

      // Calculate shape scores for all trials where matching is possible (only if shape is enabled)
      if (settings.enableShape) {
        console.log('Shape responses:', shapeUserResponses);
        for (let i = settings.currentLevel; i < gameHistory.length; i++) {
          const currentStimulus = gameHistory[i];
          const nBackStimulus = gameHistory[i - settings.currentLevel];
          const isActuallyMatch = currentStimulus && nBackStimulus && currentStimulus.shape === nBackStimulus.shape;

          const userResponded = shapeUserResponses.some(response => response.trialNumber === i + 1);

          if (isActuallyMatch && userResponded) {
            tempShapeTP++;
          } else if (isActuallyMatch && !userResponded) {
            tempShapeFN++;
          } else if (!isActuallyMatch && userResponded) {
            tempShapeFP++;
          } else if (!isActuallyMatch && !userResponded) {
            tempShapeTN++;
          }
        }
      }

      // Update level based on performance (using temporary scores)
      const totalTrials = tempPositionTP + tempPositionTN + tempPositionFP + tempPositionFN + tempAudioTP + tempAudioTN + tempAudioFP + tempAudioFN + tempColorTP + tempColorTN + tempColorFP + tempColorFN + tempShapeTP + tempShapeTN + tempShapeFP + tempShapeFN;

      let combinedAccuracy;
      if (totalTrials > 0) {
        combinedAccuracy = ((tempPositionTP + tempPositionTN + tempAudioTP + tempAudioTN + tempColorTP + tempColorTN + tempShapeTP + tempShapeTN) / totalTrials) * 100;
      } else {
        // No trials where matching was possible (N=L case)
        // Treat as perfect accuracy since player couldn't make mistakes
        combinedAccuracy = 100;
      }

      let newLevel = settings.currentLevel;
      if (combinedAccuracy >= settings.winThreshold) {
        newLevel = Math.min(8, settings.currentLevel + 1); // Level up, max 8
      } else if (combinedAccuracy <= settings.lossThreshold) {
        newLevel = Math.max(1, settings.currentLevel - 1); // Level down, min 1
      }

      // Store the next level for display
      setNextLevel(newLevel);

      if (newLevel !== settings.currentLevel) {
        let updatedSettings = { ...settings, currentLevel: newLevel };

        // // Ensure game length is at least equal to the new level
        // if (updatedSettings.gameLength < newLevel) {
        //   updatedSettings = { ...updatedSettings, gameLength: newLevel };
        // }

        onSettingsChange(updatedSettings);
        saveSettings(updatedSettings);
      }

      // Mark that we've processed the level change
      levelChangeProcessed.current = true;

      // Now set the state variables for display
      setTruePositives(tempPositionTP);
      setFalsePositives(tempPositionFP);
      setTrueNegatives(tempPositionTN);
      setFalseNegatives(tempPositionFN);
      setAudioTruePositives(tempAudioTP);
      setAudioFalsePositives(tempAudioFP);
      setAudioTrueNegatives(tempAudioTN);
      setAudioFalseNegatives(tempAudioFN);
      setColorTruePositives(tempColorTP);
      setColorFalsePositives(tempColorFP);
      setColorTrueNegatives(tempColorTN);
      setColorFalseNegatives(tempColorFN);
      setShapeTruePositives(tempShapeTP);
      setShapeFalsePositives(tempShapeFP);
      setShapeTrueNegatives(tempShapeTN);
      setShapeFalseNegatives(tempShapeFN);

      // Save game statistics
      const gameStats = {
        date: new Date().toISOString(),
        difficulty: settings.currentLevel,
        accuracy: combinedAccuracy,
        positionTP: tempPositionTP,
        positionFP: tempPositionFP,
        positionTN: tempPositionTN,
        positionFN: tempPositionFN,
        audioTP: tempAudioTP,
        audioFP: tempAudioFP,
        audioTN: tempAudioTN,
        audioFN: tempAudioFN,
        colorTP: tempColorTP,
        colorFP: tempColorFP,
        colorTN: tempColorTN,
        colorFN: tempColorFN,
        shapeTP: tempShapeTP,
        shapeFP: tempShapeFP,
        shapeTN: tempShapeTN,
        shapeFN: tempShapeFN,
        totalTrials: totalTrials,
        gridSize: settings.gridSize,
        trialDelay: settings.trialDelay,
        gameTrials: settings.gameTrials,
        matchProbability: settings.matchProbability,
        enablePosition: settings.enablePosition,
        enableAudio: settings.enableAudio,
        enableColor: settings.enableColor,
        enableShape: settings.enableShape,
      };

      saveGameStats(gameStats);
    }
  }, [isGameActive, gameHistory, userResponses, audioUserResponses, colorUserResponses, shapeUserResponses, settings.currentLevel, settings.winThreshold, settings.lossThreshold, settings.enablePosition, settings.enableAudio, settings.enableColor, settings.enableShape]);

  const totalTrialsWithMatching = Math.max(0, settings.gameTrials);

  // Function to play letter sound
  const playLetterSound = (letter) => {
    const sound = audioSounds[letter];
    if (sound) {
      // Reset the sound to beginning before playing
      sound.setCurrentTime(0);
      sound.play((success) => {
        if (!success) {
          console.log(`Failed to play sound for letter ${letter}`);
        }
      });
    }
  };

  if (!isGameActive) {
    return (
      <View style={styles.gameModeContainer}>
        <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
          <Text style={styles.exitButtonText}>×</Text>
        </TouchableOpacity>
        <ScrollView
          style={styles.gameOverContent}
          contentContainerStyle={styles.gameOverContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headerText}>Game Over!</Text>

          {/* Win/Loss Result */}
          {(() => {
            const totalTrials = positionTP + positionTN + positionFP + positionFN + audioTP + audioTN + audioFP + audioFN + colorTP + colorTN + colorFP + colorFN + shapeTP + shapeTN + shapeFP + shapeFN;
            let combinedAccuracy;
            if (totalTrials > 0) {
              combinedAccuracy = ((positionTP + positionTN + audioTP + audioTN + colorTP + colorTN + shapeTP + shapeTN) / totalTrials) * 100;
            } else {
              // No trials where matching was possible (N=L case)
              // Treat as perfect accuracy since player couldn't make mistakes
              combinedAccuracy = 100;
            }

            let resultText, resultColor, resultIcon, levelChange;

            if (combinedAccuracy >= settings.winThreshold) {
              resultText = '🎉 YOU WIN! 🎉';
              resultColor = '#27ae60';
              resultIcon = '🏆';
              levelChange = '+1';
            } else if (combinedAccuracy <= settings.lossThreshold) {
              resultText = '😔 YOU LOSE 😔';
              resultColor = '#e74c3c';
              resultIcon = '💔';
              levelChange = '-1';
            } else {
              resultText = '🤔 NEUTRAL 🤔';
              resultColor = '#f39c12';
              resultIcon = '⚖️';
              levelChange = '0';
            }

            return (
              <View style={[styles.winLossContainer, { borderColor: resultColor }]}>
                <Text style={styles.winLossIcon}>{resultIcon}</Text>
                <Text style={[styles.winLossText, { color: resultColor }]}>{resultText}</Text>
                <Text style={styles.winLossAccuracy}>
                  Your Accuracy: {combinedAccuracy.toFixed(1)}%
                </Text>
                <Text style={styles.winLossThresholds}>
                  Win: {settings.winThreshold}% | Loss: {settings.lossThreshold}%
                </Text>
                {levelChange !== '0' && (
                  <Text style={styles.levelChangeText}>
                    Level {levelChange === '+1' ? 'Up!' : 'Down!'}
                  </Text>
                )}
                {nextLevel && (
                  <Text style={styles.nextLevelText}>
                    Next Game: {nextLevel}-Back
                  </Text>
                )}
              </View>
            );
          })()}

          <View style={styles.gameOverButtons}>
            <TouchableOpacity style={styles.startButton} onPress={onExitGame}>
              <Text style={styles.buttonText}>Back to Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.playAgainButton}
              onPress={() => {
                // Reset game state
                setTrialCount(0);
                setGameHistory([]);
                setIsGameActive(true);
                setActiveCell(null);
                setCurrentLetter(null);
                setUserResponses([]);
                setAudioUserResponses([]);
                setColorUserResponses([]);
                setShapeUserResponses([]);
                setTruePositives(0);
                setFalsePositives(0);
                setTrueNegatives(0);
                setFalseNegatives(0);
                setAudioTruePositives(0);
                setAudioFalsePositives(0);
                setAudioTrueNegatives(0);
                setAudioFalseNegatives(0);
                setColorTruePositives(0);
                setColorFalsePositives(0);
                setColorTrueNegatives(0);
                setColorFalseNegatives(0);
                setShapeTruePositives(0);
                setShapeFalsePositives(0);
                setShapeTrueNegatives(0);
                setShapeFalseNegatives(0);
                setPositionButtonPressed(false);
                setAudioButtonPressed(false);
                setColorButtonPressed(false);
                setShapeButtonPressed(false);
                setAnyButtonPressed(false);
                levelChangeProcessed.current = false;
                setNextLevel(null);
              }}
            >
              <Text style={styles.buttonText}>Play Again</Text>
            </TouchableOpacity>
          </View>

          {/* Collapsible Stats Section */}
          <TouchableOpacity
            style={styles.statsToggleButton}
            onPress={() => setShowStats(!showStats)}
          >
            <Text style={styles.statsToggleText}>
              {showStats ? 'Hide Detailed Stats' : 'Show Detailed Stats'}
            </Text>
            <Text style={styles.statsToggleIcon}>
              {showStats ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>

          {showStats && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Confusion Matrices</Text>

              {settings.enablePosition && (
                <View style={styles.confusionMatrixContainer}>
                  <Text style={styles.matrixTitle}>Position</Text>
                  <View style={styles.confusionMatrix}>
                    <View style={styles.matrixHeaderRow}>
                      <Text style={styles.matrixHeaderCell}></Text>
                      <Text style={styles.matrixHeaderCell}>Actual: Match</Text>
                      <Text style={styles.matrixHeaderCell}>Actual: No Match</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: Match</Text>
                      <Text style={styles.matrixCell}>{positionTP}</Text>
                      <Text style={styles.matrixCell}>{positionFP}</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: No Match</Text>
                      <Text style={styles.matrixCell}>{positionFN}</Text>
                      <Text style={styles.matrixCell}>{positionTN}</Text>
                    </View>
                  </View>
                </View>
              )}

              {settings.enableAudio && (
                <View style={styles.confusionMatrixContainer}>
                  <Text style={styles.matrixTitle}>Audio</Text>
                  <View style={styles.confusionMatrix}>
                    <View style={styles.matrixHeaderRow}>
                      <Text style={styles.matrixHeaderCell}></Text>
                      <Text style={styles.matrixHeaderCell}>Actual: Match</Text>
                      <Text style={styles.matrixHeaderCell}>Actual: No Match</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: Match</Text>
                      <Text style={styles.matrixCell}>{audioTP}</Text>
                      <Text style={styles.matrixCell}>{audioFP}</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: No Match</Text>
                      <Text style={styles.matrixCell}>{audioFN}</Text>
                      <Text style={styles.matrixCell}>{audioTN}</Text>
                    </View>
                  </View>
                </View>
              )}

              {settings.enableColor && (
                <View style={styles.confusionMatrixContainer}>
                  <Text style={styles.matrixTitle}>Color</Text>
                  <View style={styles.confusionMatrix}>
                    <View style={styles.matrixHeaderRow}>
                      <Text style={styles.matrixHeaderCell}></Text>
                      <Text style={styles.matrixHeaderCell}>Actual: Match</Text>
                      <Text style={styles.matrixHeaderCell}>Actual: No Match</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: Match</Text>
                      <Text style={styles.matrixCell}>{colorTP}</Text>
                      <Text style={styles.matrixCell}>{colorFP}</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: No Match</Text>
                      <Text style={styles.matrixCell}>{colorFN}</Text>
                      <Text style={styles.matrixCell}>{colorTN}</Text>
                    </View>
                  </View>
                </View>
              )}

              {settings.enableShape && (
                <View style={styles.confusionMatrixContainer}>
                  <Text style={styles.matrixTitle}>Shape</Text>
                  <View style={styles.confusionMatrix}>
                    <View style={styles.matrixHeaderRow}>
                      <Text style={styles.matrixHeaderCell}></Text>
                      <Text style={styles.matrixHeaderCell}>Actual: Match</Text>
                      <Text style={styles.matrixHeaderCell}>Actual: No Match</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: Match</Text>
                      <Text style={styles.matrixCell}>{shapeTP}</Text>
                      <Text style={styles.matrixCell}>{shapeFP}</Text>
                    </View>
                    <View style={styles.matrixRow}>
                      <Text style={styles.matrixRowHeader}>You: No Match</Text>
                      <Text style={styles.matrixCell}>{shapeFN}</Text>
                      <Text style={styles.matrixCell}>{shapeTN}</Text>
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.resultsTitle}>Performance Statistics</Text>
              <View style={styles.statsTable}>
                <View style={styles.statsHeaderRow}>
                  <Text style={styles.statsHeaderCell}>Metric</Text>
                  {settings.enableAudio && <Text style={styles.statsHeaderCell}>Audio</Text>}
                  {settings.enablePosition && <Text style={styles.statsHeaderCell}>Visual</Text>}
                  {settings.enableColor && <Text style={styles.statsHeaderCell}>Color</Text>}
                  {settings.enableShape && <Text style={styles.statsHeaderCell}>Shape</Text>}
                  <Text style={styles.statsHeaderCell}>Combined</Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsRowHeader}>Accuracy</Text>
                  {settings.enableAudio && (
                    <Text style={styles.statsCell}>
                      {audioTP + audioTN + audioFP + audioFN > 0 ? ((audioTP + audioTN) / (audioTP + audioTN + audioFP + audioFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enablePosition && (
                    <Text style={styles.statsCell}>
                      {positionTP + positionTN + positionFP + positionFN > 0 ? ((positionTP + positionTN) / (positionTP + positionTN + positionFP + positionFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enableColor && (
                    <Text style={styles.statsCell}>
                      {colorTP + colorTN + colorFP + colorFN > 0 ? ((colorTP + colorTN) / (colorTP + colorTN + colorFP + colorFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enableShape && (
                    <Text style={styles.statsCell}>
                      {shapeTP + shapeTN + shapeFP + shapeFN > 0 ? ((shapeTP + shapeTN) / (shapeTP + shapeTN + shapeFP + shapeFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  <Text style={styles.statsCell}>
                    {positionTP + positionTN + positionFP + positionFN + audioTP + audioTN + audioFP + audioFN + colorTP + colorTN + colorFP + colorFN + shapeTP + shapeTN + shapeFP + shapeFN > 0 ? ((positionTP + positionTN + audioTP + audioTN + colorTP + colorTN + shapeTP + shapeTN) / (positionTP + positionTN + positionFP + positionFN + audioTP + audioTN + audioFP + audioFN + colorTP + colorTN + colorFP + colorFN + shapeTP + shapeTN + shapeFP + shapeFN) * 100).toFixed(0) : '0'}%
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsRowHeader}>Sensitivity (TPR)</Text>
                  {settings.enableAudio && (
                    <Text style={styles.statsCell}>
                      {audioTP + audioFN > 0 ? (audioTP / (audioTP + audioFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enablePosition && (
                    <Text style={styles.statsCell}>
                      {positionTP + positionFN > 0 ? (positionTP / (positionTP + positionFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enableColor && (
                    <Text style={styles.statsCell}>
                      {colorTP + colorFN > 0 ? (colorTP / (colorTP + colorFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enableShape && (
                    <Text style={styles.statsCell}>
                      {shapeTP + shapeFN > 0 ? (shapeTP / (shapeTP + shapeFN) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  <Text style={styles.statsCell}>
                    {positionTP + audioTP + colorTP + shapeTP + positionFN + audioFN + colorFN + shapeFN > 0 ? ((positionTP + audioTP + colorTP + shapeTP) / (positionTP + audioTP + colorTP + shapeTP + positionFN + audioFN + colorFN + shapeFN) * 100).toFixed(0) : '0'}%
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.statsRowHeader}>Specificity (TNR)</Text>
                  {settings.enableAudio && (
                    <Text style={styles.statsCell}>
                      {audioTN + audioFP > 0 ? (audioTN / (audioTN + audioFP) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enablePosition && (
                    <Text style={styles.statsCell}>
                      {positionTN + positionFP > 0 ? (positionTN / (positionTN + positionFP) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enableColor && (
                    <Text style={styles.statsCell}>
                      {colorTN + colorFP > 0 ? (colorTN / (colorTN + colorFP) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  {settings.enableShape && (
                    <Text style={styles.statsCell}>
                      {shapeTN + shapeFP > 0 ? (shapeTN / (shapeTN + shapeFP) * 100).toFixed(0) : '0'}%
                    </Text>
                  )}
                  <Text style={styles.statsCell}>
                    {positionTN + audioTN + colorTN + shapeTN + positionFP + audioFP + colorFP + shapeFP > 0 ? ((positionTN + audioTN + colorTN + shapeTN) / (positionTN + audioTN + colorTN + shapeTN + positionFP + audioFP + colorFP + shapeFP) * 100).toFixed(0) : '0'}%
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Show loading screen while audio is being loaded
  if (!audioSoundsLoaded) {
    return (
      <View style={styles.gameModeContainer}>
        <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
          <Text style={styles.exitButtonText}>×</Text>
        </TouchableOpacity>
        <View style={styles.gameContent}>
          <Text style={styles.headerText}>Loading Audio...</Text>
          <Text style={styles.bodyText}>Please wait while audio files are being prepared.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.gameModeContainer}>
      <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
        <Text style={styles.exitButtonText}>×</Text>
      </TouchableOpacity>
      <View style={styles.gameContent}>
        <View style={styles.trialDisplayContainer}>
          {trialCount <= settings.currentLevel ? (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>Get Ready!</Text>
              <View style={styles.dotContainer}>
                {Array.from({ length: settings.currentLevel }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.countdownDot,
                      i < (settings.currentLevel - trialCount) && styles.countdownDotFilled
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.trialText}>Trial {trialCount - settings.currentLevel}/{settings.gameTrials}</Text>
          )}
        </View>
        {settings.enablePosition && (
          <GameGrid gridSize={settings.gridSize} activeCell={activeCell} anyButtonPressed={anyButtonPressed} positionEnabled={true} />
        )}
        {!settings.enablePosition && (settings.enableColor || settings.enableShape) && (
          <GameGrid gridSize={1} activeCell={activeCell} anyButtonPressed={anyButtonPressed} positionEnabled={false} />
        )}
        <View style={styles.buttonContainer}>
          {settings.enablePosition && (
            <TouchableOpacity
              style={[
                styles.colorButton,
                trialCount <= settings.currentLevel && styles.disabledButton,
                positionButtonPressed && styles.pressedButton
              ]}
              onPress={handlePositionMatch}
              disabled={trialCount <= settings.currentLevel}
            >
              <Text style={styles.buttonText}>Position</Text>
            </TouchableOpacity>
          )}
          {settings.enableAudio && (
            <TouchableOpacity
              style={[
                styles.colorButton,
                trialCount <= settings.currentLevel && styles.disabledButton,
                audioButtonPressed && styles.pressedButton
              ]}
              onPress={handleAudioMatch}
              disabled={trialCount <= settings.currentLevel}
            >
              <Text style={styles.buttonText}>Audio</Text>
            </TouchableOpacity>
          )}
          {settings.enableColor && (
            <TouchableOpacity
              style={[
                styles.colorButton,
                trialCount <= settings.currentLevel && styles.disabledButton,
                colorButtonPressed && styles.pressedButton
              ]}
              onPress={handleColorMatch}
              disabled={trialCount <= settings.currentLevel}
            >
              <Text style={styles.buttonText}>Color</Text>
            </TouchableOpacity>
          )}
          {settings.enableShape && (
            <TouchableOpacity
              style={[
                styles.colorButton,
                trialCount <= settings.currentLevel && styles.disabledButton,
                shapeButtonPressed && styles.pressedButton
              ]}
              onPress={handleShapeMatch}
              disabled={trialCount <= settings.currentLevel}
            >
              <Text style={styles.buttonText}>Shape</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// --- Main App Component with Navigation ---
const Tab = createBottomTabNavigator();

export default function App() {
  const [isGameMode, setIsGameMode] = useState(false);
  const [gameSettings, setGameSettings] = useState(DEFAULT_SETTINGS);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load settings when app starts
  useEffect(() => {
    loadSettings().then(settings => {
      // // Ensure game length is at least equal to current level
      // if (settings.gameTrials < settings.currentLevel) {
      //   const correctedSettings = { ...settings, gameLength: settings.currentLevel };
      //   setGameSettings(correctedSettings);
      //   saveSettings(correctedSettings);
      // } else {
      setGameSettings(settings);
      // }
    });
  }, []);

  const handleStartGame = (settings) => {
    setGameSettings(settings);
    setIsGameMode(true);
  };

  const handleExitGame = () => {
    setIsGameMode(false);
  };

  const handleDataUpdate = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (isGameMode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
        <StatusBar barStyle="dark-content" />
        <GameMode settings={gameSettings} onExitGame={handleExitGame} onSettingsChange={setGameSettings} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0 },
            tabBarActiveTintColor: '#1e90ff',
            tabBarInactiveTintColor: '#888',
          }}
        >
          <Tab.Screen
            name="Start"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name="Play" focused={focused} />
              ),
            }}
          >
            {() => <StartScreen settings={gameSettings} onStartGame={handleStartGame} />}
          </Tab.Screen>
          <Tab.Screen
            name="Instructions"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name="Help" focused={focused} />
              ),
            }}
          >
            {() => <InstructionsScreen />}
          </Tab.Screen>
          <Tab.Screen
            name="Statistics"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name="Stats" focused={focused} />
              ),
            }}
          >
            {() => <StatisticsScreen refreshTrigger={refreshTrigger} currentSettings={gameSettings} />}
          </Tab.Screen>
          <Tab.Screen
            name="Settings"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon name="Settings" focused={focused} />
              ),
            }}
          >
            {() => <SettingsScreen settings={gameSettings} onSettingsChange={setGameSettings} onDataUpdate={handleDataUpdate} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  screenContentContainer: {
    alignItems: 'center',
    padding: 20,
  },
  instructionsContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  statsScreenContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  statsScreenContentContainer: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    minHeight: '100%',
  },
  settingsScreenContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  settingsScreenContentContainer: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    minHeight: '100%',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  bodyText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center'
  },
  startButton: {
    backgroundColor: '#1e90ff',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    marginVertical: 10,
    borderRadius: 10,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallButton: {
    backgroundColor: '#1e90ff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  gameModeContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  exitButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  gameContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverContent: {
    flex: 1,
  },
  gameOverContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  trialDisplayContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  trialText: {
    fontSize: 18,
    color: '#666',
  },
  countdownContainer: {
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 4,
  },
  countdownDotFilled: {
    backgroundColor: '#32cd32',
  },
  letterText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  colorButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
  },
  pressedButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.8,
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginVertical: 20,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  gameGrid: {
    backgroundColor: '#fff',
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCell: {
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#f8f8f8',
  },
  activeCellOverlay: {
    borderWidth: 1,
    borderColor: '#333',
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 15,
    lineHeight: 22,
  },
  resetButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backupSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backupButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  restoreButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  restoreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    margin: 20,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  importInputContainer: {
    marginBottom: 15,
  },
  importTextInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 14,
    minHeight: 150,
    maxHeight: 300,
    textAlignVertical: 'top',
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  pasteHelpButton: {
    backgroundColor: '#17a2b8',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pasteHelpButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 10,
  },
  modalCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalImportButton: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
  },
  modalImportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gameOverButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  playAgainButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  confusionMatrixContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  matrixTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  confusionMatrix: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    overflow: 'hidden',
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
  },
  matrixHeaderCell: {
    padding: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    width: 90,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  matrixRow: {
    flexDirection: 'row',
  },
  matrixRowHeader: {
    padding: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    width: 90,
    backgroundColor: '#f8f9fa',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  matrixCell: {
    padding: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    width: 90,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  statsTable: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 10,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
  },
  statsHeaderCell: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  statsRowHeader: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
    backgroundColor: '#f8f9fa',
    borderRightWidth: 1,
    borderColor: '#ddd',
  },
  statsCell: {
    flex: 1,
    padding: 10,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#ddd',
  },
  winLossContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginTop: 20,
    width: '90%',
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  winLossIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  winLossText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  winLossAccuracy: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  winLossThresholds: {
    fontSize: 14,
    color: '#888',
  },
  levelChangeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  nextLevelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e90ff',
    marginTop: 15,
  },
  statsToggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsToggleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statsToggleIcon: {
    fontSize: 16,
    color: '#666',
  },
  // Stats Screen Styles
  emptyStatsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStatsText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  emptyStatsSubtext: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e90ff',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 10,
    borderRadius: 16,
  },
  chartScrollContainer: {
    paddingHorizontal: 10,
  },
  recentGamesContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginVertical: 10,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  gameStatItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  gameStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  gameStatDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  gameStatDifficulty: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e90ff',
  },
  gameStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameStatAccuracy: {
    fontSize: 14,
    color: '#666',
  },
  gameStatModality: {
    fontSize: 14,
    color: '#666',
  },
  gameStatResult: {
    marginTop: 5,
  },
  gameStatResultText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  clearStatsButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginVertical: 20,
    width: '90%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  clearStatsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginBottom: 20,
  },
  refreshButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#1e90ff',
    borderColor: '#1e90ff',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  chartPlaceholder: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  toggleButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    marginHorizontal: 5,
  },
  toggleButtonActive: {
    backgroundColor: '#2980b9',
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  warningContainer: {
    backgroundColor: '#f39c12',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    marginHorizontal: 5,
  },
  warningText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalityInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colorText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 5,
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },

  startScreenContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
