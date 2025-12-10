import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const token = localStorage.getItem("token");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(!!token);

  const { data: userData, isLoading: isFetching } = useQuery({
    queryKey: ["user"],
    queryFn: () => api.getMe(),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (userData) {
      // Handle both direct user object and nested user object from API
      const user = userData.user || userData;
      // Map fullName to displayName for consistency
      if (user && user.fullName && !user.displayName) {
        user.displayName = user.fullName;
      }
      setUser(user);
    } else if (token && !isFetching) {
      // Token exists but user fetch failed - invalid token
      localStorage.removeItem("token");
      setUser(null);
    }
    setIsLoading(isFetching);
  }, [userData, isFetching, token]);

  const login = (tokenData, userData) => {
    localStorage.setItem("token", tokenData);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
