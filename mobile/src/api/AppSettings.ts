import { Platform } from 'react-native';

export const LOCAL_STORAGE_AUTH_INFO_KEY = 'auth'
export const LOCAL_STORAGE_DEVICE_ID_KEY = 'deviceId'

// Helper to determine the base URL
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9000';
  }
  
  // For Android Emulator, 10.0.2.2 is the host machine's localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:9000';
  }

  // For iOS Simulator or physical devices, use your computer's local IP
  // You can find this via `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
  // return 'http://192.168.1.XX:9000'; 
  return 'http://10.0.0.99:9000'; // Default, change if needed
};

const getWsUrl = () => {
  const baseUrl = getBaseUrl();
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = baseUrl.split('//')[1];
  return `${wsProtocol}://${host}/connection/websocket`;
};

export const API_ENDPOINT_BASE = getBaseUrl();
export const WS_ENDPOINT = getWsUrl();
