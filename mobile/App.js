import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { getCSRFToken, login } from './src/api/AppApi';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Placeholder screens
function SearchScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161a21' }}>
      <Text style={{ color: '#fff' }}>Discover Rooms (Coming Soon)</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchCsrf();
  }, []);

  const fetchCsrf = async () => {
    try {
      const token = await getCSRFToken();
      setCsrf(token);
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      const data = await login(csrf, username, password);
      setUserInfo(data);
      setAuthenticated(true);
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setUserInfo(null);
    setUsername('');
    setPassword('');
  };

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <View style={styles.loginContent}>
          <Text style={styles.title}>Disconnected</Text>
          <Text style={styles.subtitle}>Native Messenger</Text>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'My Rooms') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            else if (route.name === 'Discover') iconName = focused ? 'search' : 'search-outline';
            else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarStyle: {
            backgroundColor: '#161a21',
            borderTopColor: '#273247',
            height: 60,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: '#3280b4',
          tabBarInactiveTintColor: '#d5d5d5',
          headerStyle: {
            backgroundColor: '#161a21',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#273247',
          },
          headerTintColor: '#f1f1f1',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        })}
      >
        <Tab.Screen name="My Rooms" component={HomeScreen} />
        <Tab.Screen name="Discover" component={SearchScreen} />
        <Tab.Screen 
          name="Profile" 
          children={() => <ProfileScreen onLogout={handleLogout} />} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#161a21',
  },
  loginContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3280b4',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#d5d5d5',
    marginBottom: 40,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#273247',
    color: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3280b4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
