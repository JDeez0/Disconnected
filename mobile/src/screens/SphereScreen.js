import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, 
  TouchableOpacity, SafeAreaView, Dimensions, ActivityIndicator, Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUserGroups, submitScreenTime } from '../api/AppApi';
import { Theme } from '../context/Theme';
import { Ionicons } from '@expo/vector-icons';
import GroupInfoModal from '../components/GroupInfoModal';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.8;
const PRISM_SIZE = 45;

export default function SphereScreen({ navigation, route }) {
  const { csrf } = useAuth();
  const [screenTimeHours, setScreenTimeHours] = useState('');
  const [screenTimeMinutes, setScreenTimeMinutes] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);

  // Group Info Modal State
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const fetchRooms = async () => {
    try {
      const data = await getUserGroups();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch groups for sphere:', err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrismClick = (room) => {
    setSelectedGroup(room);
    setInfoModalVisible(true);
  };

  const handleSubmitTime = async () => {
    const hours = parseInt(screenTimeHours || '0');
    const minutes = parseInt(screenTimeMinutes || '0');

    if (isNaN(hours) || isNaN(minutes)) {
      Alert.alert('Error', 'Please enter valid numbers');
      return;
    }

    if (hours === 0 && minutes === 0) {
      Alert.alert('Error', 'Please enter a non-zero screen time');
      return;
    }

    if (minutes >= 60) {
      Alert.alert('Error', 'Minutes must be less than 60');
      return;
    }

    setSubmitting(true);
    try {
      await submitScreenTime(csrf, hours, minutes);
      setScreenTimeHours('');
      setScreenTimeMinutes('');
      setInputExpanded(false); // Collapse on success
      Alert.alert('Success', 'Screen time submitted! Check your group rankings.');
    } catch (err) {
      console.error('Submit time error:', err);
      Alert.alert('Error', 'Failed to submit screen time');
    } finally {
      setSubmitting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRooms();
    }, [])
  );

  const getPrismPosition = (index, total) => {
    if (total === 0) return { left: 0, top: 0 };
    // Position prisms INSIDE the circle
    const radius = CIRCLE_SIZE * 0.35; 
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    return {
      left: (CIRCLE_SIZE / 2) + x - PRISM_SIZE / 2,
      top: (CIRCLE_SIZE / 2) + y - PRISM_SIZE / 2,
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Sphere</Text>
          <Text style={styles.subtitle}>Your competitive world.</Text>
        </View>

        <View style={styles.sphereContainer}>
          <View style={styles.greyCircle} />
          {loading ? (
            <ActivityIndicator size="small" color="#3280b4" />
          ) : (
            rooms.map((room, index) => {
              const pos = getPrismPosition(index, rooms.length);
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[
                    styles.prism,
                    { left: pos.left, top: pos.top, backgroundColor: room.color || '#3280b4' }
                  ]}
                  onPress={() => handlePrismClick(room)}
                >
                  <View style={styles.prismInner}>
                    <Text style={styles.prismText}>{room.name.charAt(0).toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Reusable Group Info Modal */}
        <GroupInfoModal 
          visible={infoModalVisible}
          onClose={() => setInfoModalVisible(false)}
          group={selectedGroup}
          csrf={csrf}
          navigation={navigation}
        />

        <View style={styles.inputSection}>
          <View style={styles.expandableCard}>
            <TouchableOpacity 
              style={styles.cardHeader} 
              onPress={() => !inputExpanded && setInputExpanded(true)}
              activeOpacity={inputExpanded ? 1 : 0.7}
              disabled={inputExpanded}
            >
              <Ionicons name="time-outline" size={24} color="#3280b4" />
              <Text style={styles.cardTitle}>Enter screen time</Text>
              {inputExpanded ? (
                <TouchableOpacity 
                  onPress={() => setInputExpanded(false)}
                  style={styles.closeCardButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-up" size={24} color="#666" />
              )}
            </TouchableOpacity>
            
            {inputExpanded && (
              <View style={styles.cardBody}>
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="00"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={screenTimeHours}
                      onChangeText={setScreenTimeHours}
                      maxLength={2}
                    />
                    <Text style={styles.timeLabel}>h</Text>
                    <TextInput
                      style={styles.timeInput}
                      placeholder="00"
                      placeholderTextColor="#666"
                      keyboardType="numeric"
                      value={screenTimeMinutes}
                      onChangeText={setScreenTimeMinutes}
                      maxLength={2}
                    />
                    <Text style={styles.timeLabel}>m</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.submitButton}
                    onPress={handleSubmitTime}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Enter your screen time for today :)</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161a21',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3280b4',
  },
  subtitle: {
    fontSize: 14,
    color: '#d5d5d5',
    marginTop: 5,
  },
  sphereContainer: {
    width: width,
    height: width,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  greyCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#273247',
    opacity: 0.5,
    borderWidth: 2,
    borderColor: '#333',
  },
  prism: {
    position: 'absolute',
    width: PRISM_SIZE,
    height: PRISM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    transform: [{ rotate: '45deg' }],
  },
  prismInner: {
    transform: [{ rotate: '-45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  prismText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  inputSection: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 30,
    alignItems: 'center',
  },
  expandableCard: {
    backgroundColor: '#273247',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 6.65,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  closeCardButton: {
    padding: 5,
  },
  cardBody: {
    marginTop: 20,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  timeLabel: {
    color: '#3280b4',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 5,
  },
  submitButton: {
    backgroundColor: '#3280b4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  helperText: {
    color: '#666',
    marginTop: 15,
    fontSize: 12,
    textAlign: 'center',
  }
});
