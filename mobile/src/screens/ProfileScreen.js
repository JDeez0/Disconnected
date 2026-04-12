import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  ScrollView, SafeAreaView, ActivityIndicator, Alert, Platform,
  Modal, TextInput, FlatList
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, logout, getAvailableColors, updateCurrentActivity, clearActivity } from '../api/AppApi';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { csrf, setAuthenticated, fetchCsrf } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Activity Edit State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#4CAF50');
  const [availableColors, setAvailableColors] = useState([]);
  const [savingActivity, setSavingActivity] = useState(false);

  const [duration, setDuration] = useState('indefinite');

  const loadData = async () => {
    try {
      const [profileData, colors] = await Promise.all([
        getProfile(),
        getAvailableColors()
      ]);
      setProfile(profileData);
      setAvailableColors(colors || []);
      
      if (profileData?.activity) {
        setActivityName(profileData.activity.name);
        setSelectedColor(profileData.activity.color);
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveActivity = async () => {
    if (!activityName.trim()) {
      Alert.alert('Error', 'Please enter an activity name');
      return;
    }

    setSavingActivity(true);
    try {
      await updateCurrentActivity(csrf, {
        name: activityName.trim(),
        color: selectedColor,
        visibility_type: 'all_friends',
        duration_type: duration
      });
      setEditModalVisible(false);
      loadData();
    } catch (err) {
      console.error('Failed to save activity:', err);
      Alert.alert('Error', 'Failed to save activity');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleClearActivity = async () => {
    setSavingActivity(true);
    try {
      await clearActivity(csrf);
      setActivityName('');
      setEditModalVisible(false);
      loadData();
    } catch (err) {
      console.error('Failed to clear activity:', err);
      Alert.alert('Error', 'Failed to clear activity');
    } finally {
      setSavingActivity(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleLogout = async () => {
    const performLogout = async () => {
      try {
        await logout(csrf);
      } catch (err) {
        console.error('Logout API failed:', err);
      } finally {
        setAuthenticated(false);
        await fetchCsrf();
      }
    };

    if (Platform.OS === 'web') {
      if (confirm("Are you sure you want to logout?")) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Logout", onPress: performLogout, style: "destructive" }
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3280b4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.largeAvatar}>
            <Text style={styles.largeAvatarText}>
              {profile?.username?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>{profile?.username}</Text>
          <Text style={styles.email}>{profile?.email || 'No email set'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Activity</Text>
          <View style={styles.activityCard}>
            <View 
              style={[
                styles.activityIndicator, 
                { backgroundColor: profile?.activity?.color || '#4caf50' }
              ]} 
            />
            <Text style={styles.activityText}>
              {profile?.activity ? profile.activity.name : 'No activity set'}
            </Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Activity Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Activity</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="What are you doing?"
              placeholderTextColor="#666"
              value={activityName}
              onChangeText={setActivityName}
              maxLength={35}
            />

            <Text style={styles.label}>Choose Color</Text>
            <View style={styles.colorGrid}>
              {availableColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColorOption
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <Text style={styles.label}>Duration</Text>
            <View style={styles.durationRow}>
              {['hour', 'day', 'indefinite'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.durationButton,
                    duration === d && styles.activeDurationButton
                  ]}
                  onPress={() => setDuration(d)}
                >
                  <Text style={[
                    styles.durationButtonText,
                    duration === d && styles.activeDurationText
                  ]}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={{ color: '#fff' }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#f44336' }]} 
                onPress={handleClearActivity}
                disabled={savingActivity}
              >
                <Text style={{ color: '#fff' }}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#3280b4' }]} 
                onPress={handleSaveActivity}
                disabled={savingActivity}
              >
                {savingActivity ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#161a21' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161a21' },
  scrollContent: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 30 },
  largeAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#3280b4', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  largeAvatarText: { color: '#fff', fontSize: 40, fontWeight: 'bold' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#f1f1f1', marginBottom: 5 },
  email: { fontSize: 16, color: '#d5d5d5' },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#3280b4', marginBottom: 15 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#273247', padding: 15, borderRadius: 12 },
  activityIndicator: { width: 16, height: 16, borderRadius: 4, marginRight: 12 },
  activityText: { flex: 1, color: '#f1f1f1', fontSize: 16 },
  editButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#3280b4', borderRadius: 6 },
  editButtonText: { color: '#fff', fontWeight: '600' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f44336', padding: 15, borderRadius: 12, marginTop: 20 },
  logoutText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#161a21', width: '100%', maxWidth: 400, borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#273247' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: '#273247', color: '#fff', borderRadius: 10, padding: 15, marginBottom: 20, fontSize: 16 },
  label: { color: '#3280b4', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  colorOption: { width: 35, height: 35, borderRadius: 17.5, marginRight: 10, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  selectedColorOption: { borderColor: '#fff' },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  durationButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#273247', marginHorizontal: 4 },
  activeDurationButton: { backgroundColor: '#3280b4' },
  durationButtonText: { color: '#666', fontWeight: '600' },
  activeDurationText: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5, backgroundColor: '#444' },
});
