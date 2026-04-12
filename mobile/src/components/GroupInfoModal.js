import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  Modal, ActivityIndicator, FlatList, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGroupLeaderboard } from '../api/AppApi';
import { Theme } from '../context/Theme';

export default function GroupInfoModal({ visible, onClose, group, csrf, navigation }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && group) {
      fetchData();
    }
  }, [visible, group]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getGroupLeaderboard(group.id);
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Failed to fetch group info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!group) return null;

  const renderMember = ({ item }) => (
    <View style={[styles.memberItem, item.is_me && styles.myRankItem]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>{item.rank}</Text>
      </View>
      <Text style={styles.memberName}>{item.username}</Text>
      <View style={styles.timeContainer}>
        {item.has_submitted ? (
          <Text style={styles.memberTime}>{item.hours}h {item.minutes}m</Text>
        ) : (
          <Text style={styles.noTimeText}>--</Text>
        )}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.infoCard}>
          <View style={[styles.infoCardHeader, { backgroundColor: group.color || '#3280b4' }]}>
            <View>
              <Text style={styles.infoCardTitle}>{group.name}</Text>
              <Text style={styles.memberCount}>{leaderboard.length} members</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIcon}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoCardBody}>
            {leaderboard.some(m => m.activity) && (
              <>
                <Text style={styles.sectionTitle}>Activities</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.statusScroll}
                  contentContainerStyle={styles.statusScrollContent}
                >
                  {leaderboard.filter(m => m.activity).map(m => (
                    <View key={m.user_id} style={styles.statusChip}>
                      <View style={[styles.statusDot, { backgroundColor: m.activity.color }]} />
                      <Text style={styles.statusUser}>{m.username}:</Text>
                      <Text style={styles.statusText}>{m.activity.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.sectionTitle}>7-Day Screen Time Ranking</Text>
            
            {loading ? (
              <View style={styles.centerLoading}>
                <ActivityIndicator size="large" color={group.color || '#3280b4'} />
              </View>
            ) : (
              <FlatList
                data={leaderboard}
                keyExtractor={(item) => item.user_id.toString()}
                renderItem={renderMember}
                style={styles.memberList}
                ListEmptyComponent={<Text style={styles.emptyText}>No members found.</Text>}
              />
            )}

            {navigation && (
              <TouchableOpacity 
                style={[styles.enterChatButton, { backgroundColor: group.color || '#3280b4' }]}
                onPress={() => {
                  onClose();
                  navigation.navigate('GroupDetail', { 
                    roomId: group.id, 
                    roomName: group.name, 
                    roomColor: group.color,
                    csrf 
                  });
                }}
              >
                <Ionicons name="chatbubbles" size={20} color="#fff" />
                <Text style={styles.enterChatText}>Go to Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: '#161a21',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#273247',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 13,
  },
  infoCardHeader: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCardTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  memberCount: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  closeIcon: {
    padding: 4,
  },
  infoCardBody: {
    padding: 20,
    flex: 1,
  },
  sectionTitle: {
    color: '#3280b4',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 15,
  },
  statusScroll: {
    marginBottom: 20,
    flexGrow: 0,
  },
  statusScrollContent: {
    paddingRight: 20,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#273247',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusUser: {
    color: '#3280b4',
    fontWeight: 'bold',
    fontSize: 13,
    marginRight: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
  },
  centerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  memberList: {
    maxHeight: 300,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#273247',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  myRankItem: {
    borderWidth: 1,
    borderColor: '#3280b4',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#161a21',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#3280b4',
    fontWeight: 'bold',
    fontSize: 14,
  },
  memberName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  memberTime: {
    color: '#3280b4',
    fontWeight: 'bold',
    fontSize: 15,
  },
  noTimeText: {
    color: '#666',
    fontSize: 14,
  },
  enterChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 20,
  },
  enterChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
  }
});
