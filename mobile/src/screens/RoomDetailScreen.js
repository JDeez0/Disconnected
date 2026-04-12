import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TextInput, 
  TouchableOpacity, KeyboardAvoidingView, Platform, 
  ActivityIndicator, SafeAreaView 
} from 'react-native';
import { Centrifuge } from 'centrifuge';
import { getMessages, addMessage, getConnectionToken, getSubscriptionToken } from '../api/AppApi';
import { WS_ENDPOINT } from '../api/AppSettings';
import { Theme } from '../context/Theme';
import { Ionicons } from '@expo/vector-icons';

export default function RoomDetailScreen({ route, navigation }) {
  const { roomId, roomName } = route.params;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const centrifugeRef = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: roomName });
    loadMessages();
    setupRealtime();

    return () => {
      if (centrifugeRef.current) {
        centrifugeRef.current.disconnect();
      }
    };
  }, [roomId]);

  const loadMessages = async () => {
    try {
      const data = await getMessages(roomId);
      setMessages(data.reverse()); // Reversed for FlatList inverted
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = async () => {
    try {
      const token = await getConnectionToken();
      const centrifuge = new Centrifuge(WS_ENDPOINT, { token });
      centrifugeRef.current = centrifuge;

      const subChannel = `rooms:${roomId}`;
      const subToken = await getSubscriptionToken(subChannel);
      
      const sub = centrifuge.newSubscription(subChannel, { token: subToken });

      sub.on('publication', (ctx) => {
        const newMessage = ctx.data;
        setMessages(prev => [newMessage, ...prev]);
      });

      sub.subscribe();
      centrifuge.connect();
    } catch (err) {
      console.error('Real-time setup failed:', err);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      // In our current setup, we wait for the broadcast to show the message
      await addMessage('', roomId, inputText); // CSRF handled in AppApi
      setInputText('');
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageBubble,
      item.user ? styles.userMessage : styles.systemMessage
    ]}>
      {item.user && <Text style={styles.senderName}>{item.user.username}</Text>}
      <Text style={styles.messageText}>{item.content}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderMessage}
          inverted={true} // Chat style (latest at bottom)
          contentContainerStyle={styles.messageList}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && styles.disabledButton]} 
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
  },
  messageList: {
    padding: 15,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
    alignSelf: 'flex-start',
    backgroundColor: Theme.colors.backgroundLight,
  },
  userMessage: {
    backgroundColor: Theme.colors.primaryDark,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  systemMessage: {
    backgroundColor: '#333',
    alignSelf: 'center',
    borderRadius: 8,
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Theme.colors.primaryLight,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: Theme.colors.text,
  },
  timestamp: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#273247',
    backgroundColor: Theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: '#273247',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#444',
  }
});
