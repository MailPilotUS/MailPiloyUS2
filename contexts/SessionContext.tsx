import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { storage } from '../services/storage';
import { User } from '../services/types';
import { api } from '../services/api';
import { configurePurchases, getEntitlementStatus } from '../services/subscriptions';
interface SessionState {
  user: User | null;
  loading: boolean;
  subscriptionStatus: 'trialing' | 'active' | 'expired' | 'none';
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
}
const SessionContext = createContext<SessionState | undefined>(undefined);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<
    'trialing' | 'active' | 'expired' | 'none'
  >('none');
  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('newaccount') === '1') {
          await storage.deleteItem('mailpilotus_session_token');
          setLoading(false);
          return;
        }
      }
      const token = await storage.getItem('mailpilotus_session_token');
      if (token) {
        const me = await api.me();
        setUser(me);
        configurePurchases(me.id);
        const status = await getEntitlementStatus(me.subscriptionStatus);
        setSubscriptionStatus(status);
      }
    } catch {
      // no valid session
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);
  const login = async (email: string, password: string) => {
    const { user: u } = await api.login(email, password);
    setUser(u);
    configurePurchases(u.id);
    setSubscriptionStatus(await getEntitlementStatus(u.subscriptionStatus));
  };
  const signup = async (email: string, password: string) => {
    const { user: u } = await api.signup(email, password);
    setUser(u);
    configurePurchases(u.id);
    setSubscriptionStatus(await getEntitlementStatus(u.subscriptionStatus));
  };
  const logout = async () => {
    await storage.deleteItem('mailpilotus_session_token');
    setUser(null);
    setSubscriptionStatus('none');
  };
  const refreshEntitlement = async () => {
    setSubscriptionStatus(await getEntitlementStatus(user?.subscriptionStatus));
  };
  return (
    <SessionContext.Provider
      value={{ user, loading, subscriptionStatus, login, signup, logout, refreshEntitlement }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}