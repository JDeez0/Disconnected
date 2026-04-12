import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  RefreshControl, SafeAreaView, ActivityIndicator, Modal, TextInput, Alert 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroups, createGroup, joinGroup, searchGroups } from '../api/AppApi';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../context/Theme';

export default function HomeScreen({ navigation, csrf }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupPassword, setNewGroupPassword] = useState('');
  const [creating, setCreating] = useState(false);

  // Join Modal State
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinSearchQuery, setJoinSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [joinGroupPassword, setJoinGroupPassword] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (joinSearchQuery.trim().length >= 2) {
        handleSearch(joinSearchQuery.trim());
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [joinSearchQuery]);

  const handleSearch = async (query) => {
    setSearching(true);
    try {
      const results = await searchGroups(query);
      setSearchResults(results || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await getGroups();
      setGroups(data || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !newGroupPassword.trim()) {
      Alert.alert('Error', 'Please enter name and password');
      return;
    }
    if (newGroupPassword.length > 10) {
      Alert.alert('Error', 'Password must be 10 characters or less');
      return;
    }
    setCreating(true);
    try {
      await createGroup(csrf, newGroupName, newGroupPassword); 
      setNewGroupName('');
      setNewGroupPassword('');
      setCreateModalVisible(false);
      fetchGroups();
    } catch (err) {
      console.error('Create error:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!selectedGroup) return;
    if (!joinGroupPassword.trim()) {
      Alert.alert('Error', 'Please enter the group password');
      return;
    }

    setJoining(true);
    try {
      await joinGroup(csrf, selectedGroup.id, joinGroupPassword.trim());

      setJoinSearchQuery('');
      setSearchResults([]);
      setJoinGroupPassword('');
      setSelectedGroup(null);
      setJoinModalVisible(false);
      fetchGroups();

      Alert.alert('Success', `Joined ${selectedGroup.name}!`);
    } catch (err) {
      console.error('Join error:', err);
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to join group';
      Alert.alert('Error', detail);
    } finally {
      setJoining(false);
    }
  };

  const renderGroupItem = ({ item }) => {
    if (!item || !item.name) return null;
    return (
      <TouchableOpacity 
        style={styles.groupItem}
        onPress={() => navigation.navigate('GroupDetail', { 
          roomId: item.id, 
          roomName: item.name, 
          roomColor: item.color,
          csrf 
        })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message ? `${item.last_message.user.username}: ${item.last_message.content}` : 'No messages yet'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3280b4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGroupItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3280b4" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No groups found. Start one with the + button!</Text>
          </View>
        }
      />

      {/* FAB Container */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: '#4caf50', marginBottom: 15 }]} 
          onPress={() => setJoinModalVisible(true)}
        >
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Create Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start New Group</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Group Name"
              placeholderTextColor="#666"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Password (max 10 chars)"
              placeholderTextColor="#666"
              value={newGroupPassword}
              onChangeText={setNewGroupPassword}
              maxLength={10}
              secureTextEntry={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setCreateModalVisible(false)}>
                <Text style={{ color: '#fff' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#3280b4' }]} 
                onPress={handleCreateGroup}
                disabled={creating}
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Modal */}
      <Modal visible={joinModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Group</Text>
            
            {!selectedGroup ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Search by Name..."
                  placeholderTextColor="#666"
                  value={joinSearchQuery}
                  onChangeText={setJoinSearchQuery}
                />
                {searching && <ActivityIndicator size="small" color="#3280b4" style={{ marginVertical: 10 }} />}
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id.toString()}
                  style={{ maxHeight: 200, width: '100%' }}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.searchResultItem}
                      onPress={() => {
                        if (item.is_member) {
                          Alert.alert('Info', 'You are already a member of this group.');
                        } else {
                          setSelectedGroup(item);
                        }
                      }}
                    >
                      <Text style={styles.searchResultText}>{item.name}</Text>
                      {item.is_member && <Text style={styles.alreadyMemberText}>Joined</Text>}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    joinSearchQuery.length >= 2 && !searching ? (
                      <Text style={styles.noResultsText}>No groups found</Text>
                    ) : null
                  }
                />
              </>
            ) : (
              <>
                <Text style={styles.selectedGroupLabel}>Joining: {selectedGroup.name}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter Group Password"
                  placeholderTextColor="#666"
                  value={joinGroupPassword}
                  onChangeText={setJoinGroupPassword}
                  secureTextEntry={true}
                  autoFocus={true}
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => {
                  if (selectedGroup) {
                    setSelectedGroup(null);
                    setJoinGroupPassword('');
                  } else {
                    setJoinModalVisible(false);
                    setJoinSearchQuery('');
                    setSearchResults([]);
                  }
                }}
              >
                <Text style={{ color: '#fff' }}>{selectedGroup ? 'Back' : 'Cancel'}</Text>
              </TouchableOpacity>
              {selectedGroup && (
                <TouchableOpacity 
                  style={[styles.modalButton, { backgroundColor: '#4caf50' }]} 
                  onPress={handleJoinGroup}
                  disabled={joining}
                >
                  {joining ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Join</Text>}
                </TouchableOpacity>
              )}
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
  groupItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#273247' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3280b4', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: '600', color: '#f1f1f1', marginBottom: 4 },
  lastMessage: { fontSize: 14, color: '#d5d5d5' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#d5d5d5', textAlign: 'center', fontSize: 16 },
  fabContainer: { position: 'absolute', bottom: 20, right: 20, alignItems: 'center' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3280b4', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#273247', borderRadius: 15, padding: 25 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: '#161a21', color: '#fff', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalButton: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, backgroundColor: '#444' },
  searchResultItem: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#444', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchResultText: { color: '#fff', fontSize: 16 },
  alreadyMemberText: { color: '#4caf50', fontSize: 12, fontWeight: 'bold' },
  noResultsText: { color: '#666', textAlign: 'center', marginVertical: 10 },
  selectedGroupLabel: { color: '#3280b4', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
});
