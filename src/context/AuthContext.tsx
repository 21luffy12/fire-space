import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { loginUser } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: 'ADMIN' | 'ANALYST' | 'VIEWER';
  login: (email: string, role?: 'ADMIN' | 'ANALYST' | 'VIEWER') => Promise<void>;
  logout: () => void;
  switchRole: (role: 'ADMIN' | 'ANALYST' | 'VIEWER') => void;
}

const DEFAULT_USER: User = {
  id: 'usr-101',
  name: 'Chief Fire Intelligence Officer',
  email: 'chief.analyst@firespace.nasa.gov',
  role: 'ADMIN'
};

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_USER,
  role: 'ADMIN',
  login: async () => {},
  logout: () => {},
  switchRole: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('fire_space_user');
      return stored ? JSON.parse(stored) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  const role = user?.role || 'VIEWER';

  useEffect(() => {
    if (user) {
      localStorage.setItem('fire_space_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fire_space_user');
    }
  }, [user]);

  const login = async (email: string, targetRole?: 'ADMIN' | 'ANALYST' | 'VIEWER') => {
    try {
      const res = await loginUser(email, targetRole);
      if (res.success) {
        setUser(res.user);
      }
    } catch {
      setUser({
        id: `usr-${Date.now()}`,
        name: email.split('@')[0],
        email,
        role: targetRole || 'ANALYST'
      });
    }
  };

  const logout = () => {
    setUser(null);
  };

  const switchRole = (newRole: 'ADMIN' | 'ANALYST' | 'VIEWER') => {
    if (user) {
      setUser({ ...user, role: newRole });
    } else {
      setUser({
        id: 'usr-demo',
        name: `${newRole} Persona`,
        email: `${newRole.toLowerCase()}@firespace.nasa.gov`,
        role: newRole
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
