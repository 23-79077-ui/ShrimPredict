import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const LOGIN_ENDPOINT = '/api/login.php';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('shrim_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const tryLoginEndpoint = async (url, email, password) => {
    const response = await axios.post(url, { email, password });
    const data = response.data;
    if (data.success) {
      localStorage.setItem('shrim_user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    }

    const error = new Error(data.message || 'Login failed');
    error.response = { data, status: response.status };
    throw error;
  };

  const login = async (email, password) => {
    try {
      return await tryLoginEndpoint(LOGIN_ENDPOINT, email, password);
    } catch (error) {
      if (error.response) {
        const message = error.response.data?.message || 'Login failed';
        throw new Error(message);
      }
      throw new Error('Network error: could not reach the API server. Make sure XAMPP Apache is running and the backend is available at http://localhost/shrim_predict_api/backend/api.');
    }
  };

  const logout = () => {
    localStorage.removeItem('shrim_user');
    localStorage.removeItem('user');
    sessionStorage.clear();
    setUser(null);
    window.location.href = '/login';
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
