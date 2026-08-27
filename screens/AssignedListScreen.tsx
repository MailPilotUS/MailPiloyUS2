import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { EmailTask } from '../services/types';
import { api } from '../services/api';
import { colors } from '../theme';

/**
 * "In addition to the primary [Follow-Up] list, the app will allow to click
 * through to a list of assigned tasks." This screen is that list — every
 * forwarded email the user has handed off, who has it, and a way to mark it
 * done or pull it back.
 *
 * Shows a read-only due date / overdue badge if one was set on the Assign
 * screen - due dates aren't editable from this screen.
 */
export default function AssignedListScreen() {
  const [tasks, setTasks] = useState<EmailTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setTasks(await api.listAssigned());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markDone = async (task: EmailTask) => {
    await api.completeTask(task.id);
    load();
  };

  const unassign = async (task: EmailTask) => {
    Alert.alert('Move back to Follow-Up?', `"${task.subject}" will return to your Follow-Up list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move back',
        style: 'destructive',
        onPress: async () => {
          await api.unassignTask(task.id);
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assigned</Text>
      <Text style={styles.subtitle}>
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} handed off
      </Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing assigned yet</Text>
            <Text style={styles.emptyBody}>
              Tasks you hand off from your Follow-Up list will show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const overdue = !!item.dueDate && isPast(new Date(item.dueDate));
          return (
            <View style={styles.card}>
              <View style={styles.subjectRow}>
                <Text style={styles.subject} numberOfLines={2}>
                  {item.subject}
                </Text>
                {!!item.dueDate && (
                  <View style={[styles.duePill, overdue && styles.dueOverduePill]}>
                    <Text style={[styles.duePillText, overdue && styles.dueOverduePillText]}>
                      {overdue ? 'Overdue' : `Due ${format(new Date(item.dueDate), 'MMM d')}`}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.meta}>from {item.fromName || item.fromAddress}</Text>
              <View style={styles.assigneeRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.assignedTo?.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assigneeName}>{item.assignedTo?.name}</Text>
                  <Text style={styles.assignedTime}>
                    assigned{' '}
                    {item.assignedAt
                      ? formatDistanceToNow(new Date(item.assignedAt), { addSuffix: true })
                      : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => unassign(item)}>
                  <Text style={styles.secondaryBtnText}>Move back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => markDone(item)}>
                  <Text style={styles.primaryBtnText}>Mark done</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ice },
  title: { fontSize: 28, fontWeight: '700', color: colors.navy, marginTop: 60, marginLeft: 20 },
  subtitle: { fontSize: 14, color: colors.navyMuted, marginLeft: 20, marginTop: 2 },
  card: {    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  subject: { fontSize: 16, fontWeight: '700', color: colors.navy, lineHeight: 21, flex: 1 },
  duePill: {
    backgroundColor: 'rgba(11,37,69,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  duePillText: { fontSize: 11.5, fontWeight: '700', color: colors.navy },
  dueOverduePill: {
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  dueOverduePillText: { color: '#DC2626' },
  meta: { fontSize: 12.5, color: colors.navyMuted, marginTop: 4 },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  assigneeName: { fontSize: 14, fontWeight: '600', color: colors.navy },
  assignedTime: { fontSize: 11.5, color: colors.navyFaint },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 100,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.navy, fontWeight: '600', fontSize: 13 },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.navy,
    borderRadius: 100,
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  emptyBody: {
    fontSize: 14,
    color: colors.navyMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
