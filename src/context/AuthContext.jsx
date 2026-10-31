import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-toastify";
import API, { tokenStore, initializeData, resetData as resetLocalData } from "../services/api.js";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(tokenStore.get());
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load (or seed on first visit) the browser data store before anything else
  useEffect(() => {
    initializeData()
      .then((notices) => notices.forEach((n) => toast.warn(n, { autoClose: 8000 })))
      .catch((err) => toast.error(err?.message || "Failed to load saved data"))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const loadUser = async () => {
      if (token) {
        try {
          const res = await API.get("/auth/me");
          setUser(res.data.user);
        } catch {
          clearSession();
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token, ready]);

  const startSession = (data) => {
    tokenStore.set(data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const clearSession = () => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  };

  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    return startSession(res.data);
  };

  const register = async (data) => {
    const res = await API.post("/auth/register", data);
    return startSession(res.data);
  };

  const logout = () => {
    API.post("/auth/logout", { token: tokenStore.get() }).catch(() => {});
    clearSession();
  };

  // Restore the default sample data (signs everyone out)
  const resetData = async () => {
    await resetLocalData();
    clearSession();
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, resetData, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};
