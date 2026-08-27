import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api } from '../services/api';
import { Contact } from '../services/types';

/**
 * Lets the user assign the forwarded email (task) that requires action to
 * one of their saved contacts. On confirm, the task moves from Follow-Up
 * to Assigned.
 *
 * Contacts are entered manually and stored in MailPilotUS's own contact
 * list (not pulled from any external account) - this works for any email
 * provider (Gmail, Outlook, iCloud, etc.) since MailPilotUS never needs
 * access to the user's actual inbox or address book. Once added, a
 * contact is saved for future assignments too.
 *
 * An optional due date can be picked before assigning (preset chips
 * instead of a native date-picker library, so this works identically on
 * web and native with no extra dependency). If picked, it's saved via a
 * separate PATCH /v1/tasks/:id/due-date call right after the assign call
 * succeeds.
 *
 * A "Mark Complete" button is also available here, for tasks that just
 * need to be closed out without being handed off to anyone.
 */

type DuePreset = 'none' | 'today' | 'tomorrow' | 'next_week';

function computeDueDate(preset: DuePreset): string | null {
  if (preset === 'none') return null;
  const d = new Date();
  if (preset === 'today') {
    d.setHours(17, 0, 0, 0); // today 5pm
  } else if (preset === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0); // tomorrow 9am
  } else if (preset === 'next_week') {
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0); // next week 9am
  }
  return d.toISOString();
}

export default function AssignTaskScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { taskId } = route.params;

  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [duePreset, setDuePreset] = useState<DuePreset>('none');

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listContacts();
      setContacts(result.contacts);
    } catch (e: any) {
      Alert.alert('Could not load contacts', e.message);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const openAddModal = () => {
    setNewName(query.trim());
    setNewEmail('');
    setNewPhone('');
    setAddModalVisible(true);
  };

  const handleSaveNewContact = async () => {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter a name for this contact.');
      return;
    }
    setSavingContact(true);
    try {
      const created = await api.createContact({
        name: newName.trim(),
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
      });
      setContacts((prev) => [created, ...prev]);
      setAddModalVisible(false);
    } catch (e: any) {
      Alert.alert('Could not save contact', e.message);
    } finally {
      setSavingContact(false);
    }
  };

  const handleAssign = async (contact: Contact) => {
    setAssigning(contact.id);
    try {
      await api.assignTask(taskId, contact.id);
      const dueDate = computeDueDate(duePreset);
      if (dueDate) {
        try {
          await api.setDueDate(taskId, dueDate);
        } catch (e: any) {
          // Don't block the assign flow if just the due date fails to save.
          Alert.alert('Assigned, but could not save due date', e.message);
        }
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not assign task', e.message);
    } finally {
      setAssigning(null);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.completeTask(taskId);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not mark complete', e.message);
    } finally {
      setCompleting(false);
    }
  };

  const duePresets: { key: DuePreset; label: string }[] = [
    { key: 'none', label: 'No due date' },
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'next_week', label: 'Next week' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Assign to</Text>
        <TouchableOpacity
          style={styles.completeButton}
          disabled={completing}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>
            {completing ? 'Marking…' : 'Mark Complete'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Due date (optional)</Text>
      <View style={styles.chipRow}>
        {duePresets.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.chip, duePreset === p.key && styles.chipSelected]}
            onPress={() => setDuePreset(p.key)}
          >
            <Text style={[styles.chipText, duePreset === p.key && styles.chipTextSelected]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search contacts"
        placeholderTextColor={colors.navyFaint}
        value={query}
        onChangeText={setQuery}
      />
      <TouchableOpacity style={styles.addRow} onPress={openAddModal}>
        <Text style={styles.addRowText}>+ Add new contact</Text>
      </TouchableOpacity>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              No matching contacts. Tap "+ Add new contact" above to add one.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            disabled={assigning === item.id}
            onPress={() => handleAssign(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {!!item.email && <Text style={styles.meta}>{item.email}</Text>}
            </View>
            <Text style={styles.assignLabel}>
              {assigning === item.id ? 'Assigning…' : 'Assign'}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add contact</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Name"
              placeholderTextColor={colors.navyFaint}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Email (any provider)"
              placeholderTextColor={colors.navyFaint}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone (optional)"
              placeholderTextColor={colors.navyFaint}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setAddModalVisible(false)}
                disabled={savingContact}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveNewContact}
                disabled={savingContact}
              >
                <Text style={styles.modalSaveText}>
                  {savingContact ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ice, padding: 20, paddingTop: 60 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.navy },
  completeButton: {
    backgroundColor: 'rgba(22,163,74,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  completeButtonText: { color: '#16A34A', fontWeight: '700', fontSize: 13 },
  sectionLabel: { fontSize: 12.5, fontWeight: '700', color: colors.navyMuted, marginBottom: 8 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.navy },
  chipTextSelected: { color: '#fff' },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.navy,
    marginBottom: 10,
  },
  addRow: {
    paddingVertical: 10,
    marginBottom: 10,
  },
  addRowText: { color: colors.blue, fontWeight: '700', fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', color: colors.navy },
  meta: { fontSize: 12.5, color: colors.navyMuted, marginTop: 2 },
  assignLabel: { color: colors.blue, fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: colors.navyMuted, marginTop: 40, paddingHorizontal: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.navy, marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.ice,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.navy,
    marginBottom: 12,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  modalCancelText: { color: colors.navyMuted, fontWeight: '600', fontSize: 14 },
  modalSaveButton: {
    backgroundColor: colors.blue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  modalSaveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});