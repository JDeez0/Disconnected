import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { getCSRFToken, login } from './src/api/AppApi';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [csrf, setCsrf] = useState('');

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
      Alert.alert('Success', `Welcome back, ${data.username}!`);
    } catch (err) {
      console.error('Login failed:', err);
      Alert.alert('Login Failed', err.response?.data?.detail || 'Invalid credentials or server error');
    } finally {
      setLoading(false);
    }
  };

  if (authenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Disconnected</Text>
          <Text style={styles.subtitle}>Logged in as: {userInfo?.username}</Text>
          <TouchableOpacity 
            style={[styles.button, { marginTop: 20, backgroundColor: '#f44336' }]} 
            onPress={() => setAuthenticated(false)}
          >
            <Text style={styles.buttonText}>Logout (Demo)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Disconnected</Text>
        <Text style={styles.subtitle}>Welcome back!</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161a21', // Matching your web theme
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3280b4',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#d5d5d5',
    marginBottom: 30,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#273247',
    color: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3280b4',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
