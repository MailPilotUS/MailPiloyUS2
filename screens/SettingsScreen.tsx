import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSession } from '../contexts/SessionContext';
import { api } from '../services/api';
import { colors } from '../theme';
export default function SettingsScreen() {
  const { user, subscriptionStatus, logout } = useSession();
    const copyAddress = async () => {
    if (!user) return;
    await Clipboard.setStringAsync(user.forwardingAddress);
    Alert.alert('Copied', 'Your MailPilotus address is on your clipboard.');
  };
 
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your address</Text>
      <Text style={styles.body}>
        Forward any email that needs action to this address. It'll show up on your Follow-Up
        list the next time you open the app.
      </Text>
      <TouchableOpacity style={styles.addressCard} onPress={copyAddress}>
        <Text style={styles.address}>{user?.forwardingAddress}</Text>
        <Text style={styles.copyHint}>Tap to copy</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={() =>
          Share.share({ message: `Forward emails that need follow-up to ${user?.forwardingAddress}` })
        }
      >
        <Text style={styles.shareBtnText}>Share address</Text>
      </TouchableOpacity>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Subscription</Text>
        <Text style={styles.statusValue}>
          {subscriptionStatus === 'trialing' && 'Free trial active'}
          {subscriptionStatus === 'active' && 'Active'}
          {subscriptionStatus === 'expired' && 'Expired'}
          {subscriptionStatus === 'none' && 'Not subscribed'}
        </Text>
      </View>
      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ice, padding: 24, paddingTop: 70 },
  title: { fontSize: 26, fontWeight: '700', color: colors.navy },
  body: { fontSize: 14.5, color: colors.navyMuted, marginTop: 10, lineHeight: 20 },
  addressCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
  },
  address: { fontSize: 16, fontWeight: '700', color: colors.blue },
  copyHint: { fontSize: 12, color: colors.navyFaint, marginTop: 6 },
  shareBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: { color: colors.navy, fontWeight: '600' },
  statusCard: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusLabel: { color: colors.navyMuted, fontSize: 14 },
  statusValue: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  logout: { marginTop: 30, alignItems: 'center' },
  logoutText: { color: '#c0392b', fontWeight: '600' },
});