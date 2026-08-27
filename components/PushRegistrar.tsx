import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSession } from '../contexts/SessionContext';
import { registerForPushNotificationsAsync } from '../services/pushNotifications';
import { api } from '../services/api';

/**
 * Invisible component that registers this device's push token with the
 * backend once the user is signed in, so MailPilotUS can send follow-up
 * reminders (daily summary, due/overdue alerts) to their phone. Renders
 * nothing - just runs the registration side effect.
 */
export default function PushRegistrar() {
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      try {
        await api.registerPushToken(token, Platform.OS);
      } catch (err) {
        console.log('Failed to register push token with backend:', err);
      }
    })();
  }, [user]);

  return null;
}