import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  ScrollView, SafeAreaView, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { getProfile, logout } from '../api/AppApi';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ onLogout, csrf }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    const performLogout = async () => {
      try {
        await logout(csrf);
      } catch (err) {
        console.error('Logout API failed:', err);
      } finally {
        onLogout();
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
                { backgroundColor: profile?.activity?.color || '#4DD0E1' }
              ]} 
            />
            <Text style={styles.activityText}>
              {profile?.activity ? profile.activity.name : 'No activity set'}
            </Text>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
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
});
