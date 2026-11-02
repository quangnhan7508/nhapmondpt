import React, { createContext, useContext, useEffect, useState } from 'react';
import { PublicUser } from '../types/game';

interface AuthContextType {
  user: PublicUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<{ success: boolean; message?: string }>;
  register: (
    username: string,
    password: string,
    displayName: string,
    avatar: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const TOKEN_KEY = 'omnideck_token';
const USER_KEY = 'omnideck_user';

/** Token nhớ lâu (localStorage) trước, phiên tạm (sessionStorage) sau. */
const getStoredToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

const storeAuth = (token: string, user: PublicUser, remember: boolean) => {
  // Ghi nhớ: giữ qua lần mở trình duyệt sau; không thì chỉ trong tab hiện tại
  const persistent = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
  persistent.setItem(TOKEN_KEY, token);
  persistent.setItem(USER_KEY, JSON.stringify(user));
};

const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PublicUser | null>(() => {
    const saved = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch updated profile on mount if token is present
  const refreshUser = async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setUser(data.user);
        (localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(data.user));
      } else {
        // Token expired or invalid
        setUser(null);
        setToken(null);
        clearAuth();
      }
    } catch (err) {
      console.warn('[Auth] Failed to verify current user session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    const handleBalanceUpdate = (e: any) => {
      if (e?.detail?.balance !== undefined) {
        setUser((prev) => (prev ? { ...prev, balance: e.detail.balance } : prev));
      } else {
        refreshUser();
      }
    };

    window.addEventListener('omnideck:balance_updated', handleBalanceUpdate);
    return () => {
      window.removeEventListener('omnideck:balance_updated', handleBalanceUpdate);
    };
  }, []);

  const login = async (username: string, password: string, remember: boolean = true): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToken(data.token);
        setUser(data.user);
        storeAuth(data.token, data.user, remember);
        return { success: true };
      }
      return { success: false, message: data.message || 'Đăng nhập không thành công.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Lỗi kết nối máy chủ.' };
    }
  };

  const register = async (
    username: string,
    password: string,
    displayName: string,
    avatar: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName, avatar })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToken(data.token);
        setUser(data.user);
        storeAuth(data.token, data.user, true);
        return { success: true };
      }
      return { success: false, message: data.message || 'Đăng ký tài khoản không thành công.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Lỗi kết nối máy chủ.' };
    }
  };

  const logout = () => {
    const currentToken = getStoredToken();
    if (currentToken) {
      // Thu hồi token phía server, khỏi chờ
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
