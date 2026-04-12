import { Platform } from 'react-native';

export const LOCAL_STORAGE_AUTH_INFO_KEY = 'auth'
export const LOCAL_STORAGE_DEVICE_ID_KEY = 'deviceId'

// Helper to determine the base URL
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    // When running in a browser, use the current origin
    // This works both for localhost:9000 (via Nginx) and localhost:19006 (direct Expo)
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9000';
  }
  
  // For Native (iOS/Android), use the computer's local IP
  // Replace this with your actual local IP for device testing
  return 'http://10.0.0.99:9000';
};

const getWsUrl = () => {
  const baseUrl = getBaseUrl();
  const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
  const host = baseUrl.split('//')[1];
  return `${wsProtocol}://${host}/connection/websocket`;
};

export const API_ENDPOINT_BASE = getBaseUrl();
export const WS_ENDPOINT = getWsUrl();
