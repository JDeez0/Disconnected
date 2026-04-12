import axios, { AxiosHeaders } from "axios";
import { API_ENDPOINT_BASE } from "./AppSettings";

export const getCSRFToken = async (): Promise<string> => {
  const res = await axios.get(`${API_ENDPOINT_BASE}/api/csrf/`, {});
  // Axios 1.x headers.get is case-insensitive
  const token = res.headers.get ? res.headers.get('X-CSRFToken') : (res.headers as any)['x-csrftoken'];
  if (token) {
    return token as string;
  }
  throw new Error('no X-CSRFToken in headers');
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

export const logout = async (csrfToken: string, deviceId: string = '') => {
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

export const getGroups = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/`);
  return response.data.results
};

export const searchGroups = async (query: string = '') => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/search/`, {
    params: { q: query }
  });
  return response.data.results
};

export const getGroup = async (roomId: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/`);
  return response.data
};

export const getMessages = async (roomId: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/messages/`);
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

export const createGroup = async (csrfToken: string, name: string, password: string = '', color: string = '#3280b4', timezone: string = 'UTC') => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/rooms/create/`, { name, password, color, timezone }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const joinGroup = async (csrfToken: string, roomId: string, password: string = '') => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/join/`, { password }, {
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

export const sendFriendRequest = async (csrfToken: string, userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/send/${userId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const acceptFriendRequest = async (csrfToken: string, requestId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/accept/${requestId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const rejectFriendRequest = async (csrfToken: string, requestId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/reject/${requestId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const cancelFriendRequest = async (csrfToken: string, requestId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/request/cancel/${requestId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const unfriend = async (csrfToken: string, userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/unfriend/${userId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const blockUser = async (csrfToken: string, userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/block/${userId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const unblockUser = async (csrfToken: string, userId: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/unblock/${userId}/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const getBlockedUsers = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/blocked/`);
  return response.data
}

export const setUserStatus = async (csrfToken: string, status: 'online' | 'away' | 'busy' | 'offline', customStatus?: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/friends/status/set/`, {
    status,
    custom_status: customStatus || ''
  }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const getUserStatus = async (userId: number) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/friends/status/${userId}/`);
  return response.data
}

// Activity-related API functions
export const getAvailableColors = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/activity/colors/`);
  return response.data
}

export const getCurrentActivity = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/activity/current/`);
  return response.data
}

export const setCurrentActivity = async (csrfToken: string, activityData: any) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/activity/current/`, activityData, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const updateCurrentActivity = async (csrfToken: string, activityData: any) => {
  const response = await axios.put(`${API_ENDPOINT_BASE}/api/activity/current/`, activityData, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const submitScreenTime = async (csrfToken: string, hours: number, minutes: number) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/activity/screen-time/`, { hours, minutes }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const clearActivity = async (csrfToken: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/activity/clear/`, {}, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const getUserActivity = async (userId: number) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/activity/user/${userId}/`);
  return response.data
}

export const getActivityPresets = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/activity/presets/`);
  return response.data
}

export const createActivityPreset = async (csrfToken: string, presetData: any) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/activity/presets/`, presetData, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const updateActivityPreset = async (csrfToken: string, presetId: number, presetData: any) => {
  const response = await axios.put(`${API_ENDPOINT_BASE}/api/activity/presets/${presetId}/`, presetData, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const deleteActivityPreset = async (csrfToken: string, presetId: number) => {
  const response = await axios.delete(`${API_ENDPOINT_BASE}/api/activity/presets/${presetId}/`, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const applyActivityPreset = async (csrfToken: string, presetId: number, activityData: any) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/activity/presets/${presetId}/apply/`, { activity: activityData }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const getUserGroups = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/activity/rooms/`);
  return response.data
}

export const getGroupLeaderboard = async (roomId: string) => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/rooms/${roomId}/leaderboard/`);
  return response.data
}

// Profile-related API functions
export const getProfile = async () => {
  const response = await axios.get(`${API_ENDPOINT_BASE}/api/profile/`);
  return response.data
}

export const changePassword = async (csrfToken: string, oldPassword: string, newPassword: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/profile/change-password/`, {
    old_password: oldPassword,
    new_password: newPassword
  }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}

export const deleteAccount = async (csrfToken: string, password: string) => {
  const response = await axios.post(`${API_ENDPOINT_BASE}/api/profile/delete-account/`, {
    password
  }, {
    headers: {
      "X-CSRFToken": csrfToken
    }
  });
  return response.data
}
