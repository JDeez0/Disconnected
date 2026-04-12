import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { getCSRFToken, login, register } from './src/api/AppApi';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RoomDetailScreen from './src/screens/RoomDetailScreen';

import { enableScreens } from 'react-native-screens';

// Disable screens to avoid the Fabric 'expected boolean, got string' error
enableScreens(false);

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();

function HomeStackScreen({ route }) {
  const { csrf } = route.params || {};
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#161a21' },
        headerTintColor: '#f1f1f1',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <HomeStack.Screen name="MyRoomsList" options={{ title: 'My Rooms' }}>
        {(props) => <HomeScreen {...props} csrf={csrf} />}
      </HomeStack.Screen>
      <HomeStack.Screen name="RoomDetail" component={RoomDetailScreen} />
    </HomeStack.Navigator>
  );
}

function SearchScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#161a21' }}>
      <Text style={{ color: '#fff' }}>Discover Rooms (Coming Soon)</Text>
    </View>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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

  const handleAuth = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      if (isRegistering === true) {
        await register(csrf, username, email, password);
      } else {
        await login(csrf, username, password);
      }
      setAuthenticated(true);
    } catch (err) {
      console.error('Auth error:', err);
      Alert.alert('Error', err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthenticated(false);
    setUsername('');
    setEmail('');
    setPassword('');
    setIsRegistering(false);
    // Fetch a fresh token for the next session
    await fetchCsrf();
  };

  if (authenticated === false) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <View style={styles.loginContent}>
          <Text style={styles.title}>Disconnected</Text>
          <Text style={styles.subtitle}>{isRegistering === true ? 'Create Account' : 'Native Messenger'}</Text>
          
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#666"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            {isRegistering === true && (
              <TextInput
                style={styles.input}
                placeholder="Email (optional)"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
            />
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleAuth}
              disabled={loading === true}
            >
              {loading === true ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegistering === true ? 'Sign Up' : 'Login'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.toggleButton} 
              onPress={() => setIsRegistering(!isRegistering)}
            >
              <Text style={styles.toggleText}>
                {isRegistering === true ? 'Already have an account? Login' : "Don't have an account? Sign up"}
              </Text>
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
          headerShown: false,
        })}
      >
        <Tab.Screen 
          name="My Rooms" 
          component={HomeStackScreen} 
          initialParams={{ csrf }} 
        />
        <Tab.Screen name="Discover" component={SearchScreen} />
        <Tab.Screen 
          name="Profile" 
          options={{ 
            headerShown: true, 
            headerTintColor: '#fff', 
            headerStyle: { backgroundColor: '#161a21' } 
          }}
        >
          {() => <ProfileScreen onLogout={handleLogout} csrf={csrf} />}
        </Tab.Screen>
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
  toggleButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    color: '#3280b4',
    fontSize: 14,
    fontWeight: '600',
  },
});
