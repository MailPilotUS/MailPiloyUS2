import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { storage } from '../services/storage';
import { User } from '../services/types';
import { api } from '../services/api';
import {
  configurePurchases,
  getEntitlementStatus,
  SubscriptionStatus,
} from '../services/subscriptions';

interface SessionState {
  user: User | null;
  loading: boolean;
  subscriptionStatus: SubscriptionStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('none');

  const applyEntitlement = useCallback(async (currentUser: User) => {
    await configurePurchases(currentUser.id);
    const status = await getEntitlementStatus(currentUser.subscriptionStatus);
    setSubscriptionStatus(status);
  }, []);

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
        await applyEntitlement(me);
      }
    } catch {
      // no valid session
    } finally {
      setLoading(false);
    }
  }, [applyEntitlement]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const { user: u } = await api.login(email, password);
    setUser(u);
    await applyEntitlement(u);
  };

  const signup = async (email: string, password: string) => {
    const { user: u } = await api.signup(email, password);
    setUser(u);
    await applyEntitlement(u);
  };

  const logout = async () => {
    await storage.deleteItem('mailpilotus_session_token');
    setUser(null);
    setSubscriptionStatus('none');
  };

  const refreshEntitlement = useCallback(async () => {
    if (!user) {
      setSubscriptionStatus('none');
      return;
    }

    try {
      // Refresh the backend user first. This matters on web/Stripe and also
      // keeps the local User object current after a billing webhook update.
      const freshUser = await api.me();
      setUser(freshUser);
      await applyEntitlement(freshUser);
    } catch {
      // If refreshing /me fails temporarily, still re-check native RevenueCat
      // rather than granting access based on a stale cached state.
      await applyEntitlement(user);
    }
  }, [user, applyEntitlement]);

  // Re-check entitlement whenever the app returns to the foreground. This is
  // what catches a cancellation reaching its expiration date or a billing
  // problem being resolved while the user was outside the app.
  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshEntitlement().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [user, refreshEntitlement]);

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
