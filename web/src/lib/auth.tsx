import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { get, post, setToken, getToken, setUnauthorizedHandler } from './api';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
  officeLocation: string;
  mfaEnabled: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired?: boolean; mfaToken?: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await get<User>('/api/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    refresh();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await post<any>('/api/auth/login', { email, password });
    if (res.mfaRequired) return { mfaRequired: true, mfaToken: res.mfaToken };
    setToken(res.token);
    setUser(res.user);
    return {};
  };

  const verifyMfa = async (mfaToken: string, code: string) => {
    const res = await post<any>('/api/auth/mfa/verify', { mfaToken, code });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await post('/api/auth/logout');
    } catch {
      /* token may already be invalid */
    }
    setToken(null);
    setUser(null);
  };

  const can = (permission: string) =>
    !!user && (user.permissions.includes('*') || user.permissions.includes(permission));

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfa, logout, can, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
