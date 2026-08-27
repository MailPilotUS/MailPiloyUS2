import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  AppState,
  AppStateStatus,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { EmailTask } from '../services/types';
import { api } from '../services/api';
import { colors } from '../theme';
import HomeScreenPrompt from './HomeScreenPrompt';

const PRICE_IDS: Record<string, string> = {
  'pro-monthly': 'price_1Tx4i6FZ1VLALyugBjZvOONs',
  'pro-annual': 'price_1Tx5MYFZ1VLALyugWErltx9a',
};

/**
 * Home screen. Requirement: "whenever the device is awakened, a list appears
 * on the device that shows all emails so forwarded." We satisfy this by:
 *  1) Refetching the Follow-Up list whenever AppState transitions to 'active'
 *     (i.e. the device/app is woken up or brought to the foreground).
 *  2) This screen is the initial route, so it's what the user sees first.
 * A background push notification (registered in services/notifications.ts)
 * also updates a badge count so new items are visible from the lock screen.
 *
 * Due dates are set on the Assign screen (preset chips there), not from
 * here - this list just shows a read-only due date / overdue badge when
 * one has been set.
 */
export default function FollowUpListScreen() {
  const navigation = useNavigation<any>();
  const [tasks, setTasks] = useState<EmailTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const load = useCallback(async () => {
    const data = await api.listFollowUp();
    setTasks(data);
  }, []);

  useEffect(() => {
    load();

    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        load();
      }

      appState.current = next;
    });

    return () => sub.remove();
  }, [load]);

  /**
   * If the user arrived here already logged in (e.g. clicked a mailpilotus.com
   * pricing button while a session was still active, skipping the sign-in
   * screen entirely), pick up the ?plan= param here too and send them
   * straight to Stripe Checkout.
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');

    if (plan && PRICE_IDS[plan]) {
      (async () => {
        try {
          const { url } = await api.createCheckoutSession(PRICE_IDS[plan]);
          window.location.href = url;
        } catch (e) {
          console.warn('Checkout redirect failed', e);
        }
      })();
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /**
   * Fallback used when we can't build a deep link back into the user's own
   * inbox (e.g. unknown/business email provider). Opens a mailto: reply
   * pre-filled with a quote of the original message, same as the old
   * "Reply" behavior.
   */
  const replyToSender = (item: EmailTask) => {
    const subject = encodeURIComponent(`Re: ${item.subject}`);
    const quotedDate = new Date(item.receivedAt).toLocaleString();
    const quotedFrom = item.fromName
      ? `${item.fromName} <${item.fromAddress}>`
      : item.fromAddress;
    const quotedText = item.snippet || '';
    const body = `\n\nOn ${quotedDate}, ${quotedFrom} wrote:\n> ${quotedText}`;

    const url = `mailto:${item.fromAddress}?subject=${subject}&body=${encodeURIComponent(
      body
    )}`;

    Linking.openURL(url).catch(() => {
      console.warn('Could not open mail client');
    });
  };

  /**
   * "View Original" - takes the user back to the original forwarded email
   * sitting in their own inbox, rather than composing a new reply.
   * Uses forwarderAddress (the account holder's own address, e.g. their
   * Gmail) to figure out which webmail provider to deep-link into.
   * Falls back to the mailto reply behavior when we don't recognize the
   * provider, or when forwarderAddress isn't populated (older items
   * forwarded before this field existed).
   */
  const viewOriginal = (item: EmailTask) => {
    const forwarder = (item.forwarderAddress || '').toLowerCase();
    const query = `from:${item.fromAddress} subject:${item.subject}`;

    if (
      forwarder.includes('@gmail.com') ||
      forwarder.includes('@googlemail.com')
    ) {
      const url = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(
        query
      )}`;

      Linking.openURL(url).catch(() => replyToSender(item));
      return;
    }

    if (
      forwarder.includes('@outlook.com') ||
      forwarder.includes('@hotmail.com') ||
      forwarder.includes('@live.com') ||
      forwarder.includes('@msn.com')
    ) {
      const url = `https://outlook.live.com/mail/0/search?q=${encodeURIComponent(
        query
      )}`;

      Linking.openURL(url).catch(() => replyToSender(item));
      return;
    }

    // iCloud, Yahoo, business domains, or unknown provider - fall back to
    // the mailto reply-with-quoted-text behavior.
    replyToSender(item);
  };

  /**
   * Marks a task done directly from the Follow-Up list (without assigning it
   * to anyone first). Removes it from this list on success.
   */
  const handleComplete = async (item: EmailTask) => {
    setCompleting(item.id);

    try {
      await api.completeTask(item.id);
      setTasks((prev) => prev.filter((t) => t.id !== item.id));
    } catch (e: any) {
      Alert.alert('Could not mark complete', e.message);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <View style={styles.container}>
      <HomeScreenPrompt />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Follow-Up</Text>

          <Text style={styles.subtitle}>
            {tasks.length} {tasks.length === 1 ? 'email' : 'emails'} waiting
          </Text>
        </View>

        <TouchableOpacity
          style={styles.assignedButton}
          onPress={() => navigation.navigate('Assigned')}
        >
          <Text style={styles.assignedButtonText}>Assigned →</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing waiting on you</Text>

            <Text style={styles.emptyBody}>
              Forward an email that needs action to your MailPilotus address and
              it will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const overdue = !!item.dueDate && isPast(new Date(item.dueDate));

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => viewOriginal(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.from} numberOfLines={1}>
                {item.fromName || item.fromAddress}
              </Text>

              <Text style={styles.subject} numberOfLines={2}>
                {item.subject}
              </Text>

              {!!item.snippet && (
                <Text style={styles.snippet} numberOfLines={1}>
                  {item.snippet}
                </Text>
              )}

              <View style={styles.rowBottom}>
                <Text style={styles.time}>
                  forwarded{' '}
                  {formatDistanceToNow(new Date(item.receivedAt), {
                    addSuffix: true,
                  })}
                </Text>

                <View style={styles.pillRow}>
                  {!!item.dueDate && (
                    <View
                      style={[
                        styles.duePill,
                        overdue && styles.dueOverduePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.duePillText,
                          overdue && styles.dueOverduePillText,
                        ]}
                      >
                        {overdue
                          ? 'Overdue'
                          : `Due ${format(
                              new Date(item.dueDate),
                              'MMM d'
                            )}`}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.replyPill}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      viewOriginal(item);
                    }}
                  >
                    <Text style={styles.replyPillText}>View Original</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.assignPill}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      navigation.navigate('AssignTask', {
                        taskId: item.id,
                      });
                    }}
                  >
                    <Text style={styles.assignPillText}>Assign</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.completePill}
                    disabled={completing === item.id}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      handleComplete(item);
                    }}
                  >
                    <Text style={styles.completePillText}>
                      {completing === item.id ? 'Marking…' : 'Complete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ice,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 20,
    paddingTop: 60,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.navy,
  },

  subtitle: {
    fontSize: 14,
    color: colors.navyMuted,
    marginTop: 2,
  },

  assignedButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },

  assignedButtonText: {
    color: colors.blue,
    fontWeight: '600',
    fontSize: 13,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 12,
  },

  from: {
    fontSize: 12,
    color: colors.navyMuted,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },

  subject: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
    lineHeight: 21,
  },

  snippet: {
    fontSize: 13,
    color: colors.navyMuted,
    marginTop: 4,
  },

  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },

  time: {
    fontSize: 11.5,
    color: colors.navyFaint,
  },

  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  duePill: {
    backgroundColor: 'rgba(11,37,69,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },

  duePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.navy,
  },

  dueOverduePill: {
    backgroundColor: 'rgba(220,38,38,0.12)',
  },

  dueOverduePillText: {
    color: '#DC2626',
  },

  replyPill: {
    backgroundColor: 'rgba(11,37,69,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },

  replyPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.navy,
  },

  assignPill: {
    backgroundColor: 'rgba(22,112,232,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },

  assignPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.blue,
  },

  completePill: {
    backgroundColor: 'rgba(22,163,74,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },

  completePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16A34A',
  },

  empty: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
  },

  emptyBody: {
    fontSize: 14,
    color: colors.navyMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
