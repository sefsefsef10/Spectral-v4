import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";

type User = {
  id: string;
  username: string;
  role: "health_system" | "vendor";
  healthSystemId?: string | null;
  vendorId?: string | null;
};

type AuthContextType = {
  user: User | null | undefined;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
};

type RegisterData = {
  username: string;
  password: string;
  role: "health_system" | "vendor";
  organizationName: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    queryFn: async ({ queryKey }) => {
      try {
        const url = queryKey[0] as string;
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      } catch {
        return null;
      }
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
    // Wait for user query to refetch
    await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
  };

  const register = async (data: RegisterData) => {
    await registerMutation.mutateAsync(data);
    // Wait for user query to refetch
    await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
