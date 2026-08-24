import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../lib/apiClient";

interface CurrentUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  profile: { name: string } | null;
}

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  dateOfBirth: string; // ISO date
  sex: "MALE" | "FEMALE" | "OTHER";
  heightCm: number;
  activityLevel: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
  currentWeightKg: number;
  targetWeightKg: number;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const me = await api.get<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function login(email: string, password: string) {
    await api.post("/auth/login", { email, password });
    await refreshMe();
  }

  async function register(payload: RegisterPayload) {
    await api.post("/auth/register", payload);
    await refreshMe();
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
