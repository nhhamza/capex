import axios from 'axios';

export const axiosClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add organizationId
axiosClient.interceptors.request.use(
  (config) => {
    // TODO: Get organizationId from auth context
    // For now, we'll add it as a header when available
    const orgId = localStorage.getItem('organizationId');
    if (orgId) {
      config.headers['X-Organization-Id'] = orgId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
