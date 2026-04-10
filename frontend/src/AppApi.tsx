import axios, { AxiosHeaders } from "axios";
import { API_ENDPOINT_BASE } from "./AppSettings";

export const getCSRFToken = async (): Promise<string> => {
  const res = await axios.get(`${API_ENDPOINT_BASE}/api/csrf/`, {});
  const headers = res.headers
  if (headers instanceof AxiosHeaders && headers.has('X-CSRFToken')) {
    return headers.get("X-CSRFToken") as string
  }
  throw new Error('no X-CSRFToken in headers')
};

export const login = async (csrfToken: string, username: string, password: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/login/`, { username, password }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const register = async (csrfToken: string, username: string, email: string, password: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/register/`, { username, email, password }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const logout = async (csrfToken: string, deviceId: string) => {
  await axios.post(`${API_ENDPOINT_BASE}/api/logout/`, {
    'device_id': deviceId
  }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
}

export const getConnectionToken = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/token/connection/`, {})
  return response.data.token;
}

export const getSubscriptionToken = async (channel: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/token/subscription/`, {
    params: { channel: channel }
  });
  return response.data.token;
}

export const getRooms = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return response.data.results
};

export const searchRooms = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/search/`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return response.data.results
};

export const getRoom = async (roomId: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  return response.data
};

export const getMessages = async (roomId: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/messages/`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  })
  return response.data.results
}

export const addMessage = async (csrfToken: string, roomId: string, content: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/messages/`, {
    'content': content
  }, {
    headers: {
      'X-CSRFToken': csrfToken
    }
  });
  return response.data
}

export const joinRoom = async (csrfToken: string, roomId: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/join/`, {}, {
    headers: {
      'X-CSRFToken': csrfToken
    }
  });
  return response.data
}

export const leaveRoom = async (csrfToken: string, roomId: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/leave/`, {}, {
    headers: {
      'X-CSRFToken': csrfToken
    }
  });
  return response.data
}

export const registerDevice = async (csrfToken: string, deviceInfo: any) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/device/register/`, {
    'device': deviceInfo
  }, {
    headers: {
      'X-CSRFToken': csrfToken
    }
  });
  return response.data
}

// Friend-related API functions
export const searchUsers = async (query: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/search/`, {
    params: { q: query }
  });
  return response.data
}

export const getFriends = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/`);
  return response.data
}

export const getFriendRequests = async (type: 'all' | 'sent' | 'received' = 'all') => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/requests/`, {
    params: { type }
  });
  return response.data
}

export const sendFriendRequest = async (userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/send/${userId}/`);
  return response.data
}

export const acceptFriendRequest = async (requestId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/accept/${requestId}/`);
  return response.data
}

export const rejectFriendRequest = async (requestId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/reject/${requestId}/`);
  return response.data
}

export const cancelFriendRequest = async (requestId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/cancel/${requestId}/`);
  return response.data
}

export const unfriend = async (userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/unfriend/${userId}/`);
  return response.data
}

export const blockUser = async (userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/block/${userId}/`);
  return response.data
}

export const unblockUser = async (userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/unblock/${userId}/`);
  return response.data
}

export const getBlockedUsers = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/blocked/`);
  return response.data
}

export const setUserStatus = async (status: 'online' | 'away' | 'busy' | 'offline', customStatus?: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/status/set/`, {
    status,
    custom_status: customStatus || ''
  });
  return response.data
}

export const getUserStatus = async (userId: number) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/status/${userId}/`);
  return response.data
}
