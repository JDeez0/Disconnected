import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons, FontAwesome } from '@expo/vector-icons';

import { login, register } from './src/api/AppApi';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import SphereScreen from './src/screens/SphereScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';

import { enableScreens } from 'react-native-screens';

enableScreens(false);

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const HomeStack = createStackNavigator();
const SphereStack = createStackNavigator();

// Common Header Options
const getCommonHeaderOptions = (navigation) => ({
  headerStyle: { backgroundColor: '#161a21', borderBottomWidth: 1, borderBottomColor: '#273247' },
  headerTintColor: '#f1f1f1',
  headerTitleStyle: { fontWeight: 'bold' },
  headerRight: () => (
    <TouchableOpacity 
      style={{ marginRight: 15 }} 
      onPress={() => navigation.navigate('ProfileModal')}
    >
      <Ionicons name="person-circle-outline" size={28} color="#3280b4" />
    </TouchableOpacity>
  ),
});

function HomeStackScreen({ navigation }) {
  const { csrf } = useAuth();
  return (
    <HomeStack.Navigator
      screenOptions={getCommonHeaderOptions(navigation)}
    >
      <HomeStack.Screen name="MyGroupsList" options={{ title: 'Groups' }}>
        {props => <HomeScreen {...props} csrf={csrf} />}
      </HomeStack.Screen>
      <HomeStack.Screen name="GroupDetail" component={GroupDetailScreen} />
    </HomeStack.Navigator>
  );
}

function SphereStackScreen({ navigation }) {
  return (
    <SphereStack.Navigator
      screenOptions={getCommonHeaderOptions(navigation)}
    >
      <SphereStack.Screen name="SphereMain" component={SphereScreen} options={{ title: 'Sphere' }} />
      <SphereStack.Screen name="GroupDetail" component={GroupDetailScreen} />
    </SphereStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Groups') {
            return <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />;
          } else if (route.name === 'Sphere') {
            return <FontAwesome name="globe" size={size} color={color} />;
          }
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
      <Tab.Screen name="Groups" component={HomeStackScreen} />
      <Tab.Screen name="Sphere" component={SphereStackScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { 
    authenticated, setAuthenticated, 
    csrf, fetchCsrf,
    loading, setLoading 
  } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }
    setLoading(true);
    try {
      if (isRegistering === true) {
        console.log('Attempting registration for:', username);
        await register(csrf, username, email, password);
      } else {
        console.log('Attempting login for:', username);
        await login(csrf, username, password);
      }
      // Refresh CSRF token after login as it might have rotated
      await fetchCsrf();
      setAuthenticated(true);
    } catch (err) {
      console.error('Auth error full:', err);
      const detail = err.response?.data?.detail || err.message || 'Authentication failed';
      Alert.alert('Error', detail);
    } finally {
      setLoading(false);
    }
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
      <RootStack.Navigator>
        <RootStack.Screen 
          name="Main" 
          component={MainTabs} 
          options={{ headerShown: false }} 
        />
        <RootStack.Screen 
          name="ProfileModal" 
          component={ProfileScreen}
          options={{ 
            title: 'Profile',
            headerStyle: { backgroundColor: '#161a21' },
            headerTintColor: '#fff',
            presentation: 'modal' 
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#161a21' },
  loginContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#3280b4', marginBottom: 5 },
  subtitle: { fontSize: 18, color: '#d5d5d5', marginBottom: 40 },
  form: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#273247', color: '#fff', borderRadius: 10, padding: 15, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#3280b4', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  toggleButton: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#3280b4', fontSize: 14, fontWeight: '600' },
  sphereContainer: { flex: 1, backgroundColor: '#161a21', alignItems: 'center', paddingTop: 20 },
  sphereHeader: { alignItems: 'center', marginBottom: 20 },
  sphereTitle: { fontSize: 28, fontWeight: 'bold', color: '#3280b4' },
  sphereSubtitle: { fontSize: 14, color: '#d5d5d5', marginTop: 5 },
  sphereCircleContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  greyCircle: { backgroundColor: '#273247', opacity: 0.5, borderWidth: 2, borderColor: '#333' },
});
