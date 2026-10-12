import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';

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

const SessionContext =
  createContext<SessionState | undefined>(undefined);

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>('none');

  const userRef = useRef<User | null>(null);
  const sessionVersion = useRef(0);

  const applyEntitlement = useCallback(
    async (currentUser: User): Promise<SubscriptionStatus> => {
      await configurePurchases(currentUser.id);

      return getEntitlementStatus(
        currentUser.subscriptionStatus
      );
    },
    []
  );

  const commitSession = useCallback(
    async (currentUser: User, version: number) => {
      const status = await applyEntitlement(currentUser);

      if (version !== sessionVersion.current) return;

      userRef.current = currentUser;
      setSubscriptionStatus(status);
      setUser(currentUser);
    },
    [applyEntitlement]
  );

  const bootstrap = useCallback(async () => {
    const version = ++sessionVersion.current;

    setLoading(true);

    try {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        const params = new URLSearchParams(
          window.location.search
        );

        if (params.get('newaccount') === '1') {
          await storage.deleteItem(
            'mailpilotus_session_token'
          );

          if (version === sessionVersion.current) {
            userRef.current = null;
            setUser(null);
            setSubscriptionStatus('none');
          }

          return;
        }
      }

      const token = await storage.getItem(
        'mailpilotus_session_token'
      );

      if (!token) return;

      const currentUser = await api.me();

      await commitSession(currentUser, version);
    } catch (error) {
      console.warn(
        'MailPilotUs session restoration failed:',
        error
      );
    } finally {
      if (version === sessionVersion.current) {
        setLoading(false);
      }
    }
  }, [commitSession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (
    email: string,
    password: string
  ) => {
    const version = ++sessionVersion.current;

    setLoading(true);

    try {
      const { user: loginUser } = await api.login(
        email,
        password
      );

      let currentUser = loginUser;

      try {
        currentUser = await api.me();
      } catch (error) {
        console.warn(
          'Could not refresh account after login:',
          error
        );
      }

      await commitSession(currentUser, version);
    } finally {
      if (version === sessionVersion.current) {
        setLoading(false);
      }
    }
  };

  const signup = async (
    email: string,
    password: string
  ) => {
    const version = ++sessionVersion.current;

    setLoading(true);

    try {
      const { user: newUser } = await api.signup(
        email,
        password
      );

      await commitSession(newUser, version);
    } finally {
      if (version === sessionVersion.current) {
        setLoading(false);
      }
    }
  };

  const logout = async () => {
    ++sessionVersion.current;

    await storage.deleteItem(
      'mailpilotus_session_token'
    );

    userRef.current = null;
    setUser(null);
    setSubscriptionStatus('none');
    setLoading(false);
  };

  const refreshEntitlement = useCallback(async () => {
    const currentUser = userRef.current;

    if (!currentUser) return;

    const version = sessionVersion.current;

    try {
      const freshUser = await api.me();

      await commitSession(freshUser, version);
    } catch (error) {
      console.warn(
        'Could not refresh subscription:',
        error
      );
    }
  }, [commitSession]);

  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          refreshEntitlement().catch(() => undefined);
        }
      }
    );

    return () => subscription.remove();
  }, [user, refreshEntitlement]);

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        subscriptionStatus,
        login,
        signup,
        logout,
        refreshEntitlement,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error(
      'useSession must be used within SessionProvider'
    );
  }

  return context;
}
