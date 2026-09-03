import { createContext, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  const { data: userData, isLoading: isFetching } = useQuery({
    queryKey: ["user"],
    queryFn: () => api.getMe(),
    enabled: !!token,
    retry: false,
  });

  const currentUser = userData?.user || userData;
  const user =
    currentUser?.fullName && !currentUser.displayName
      ? { ...currentUser, displayName: currentUser.fullName }
      : currentUser || null;

  const login = (tokenData, nextUser) => {
    localStorage.setItem("token", tokenData);
    queryClient.setQueryData(["user"], nextUser);
    setToken(tokenData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    queryClient.removeQueries({ queryKey: ["user"], exact: true });
    setToken(null);
  };

  const value = {
    user,
    isAuthenticated: !!token && !!user,
    isLoading: !!token && isFetching,
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
