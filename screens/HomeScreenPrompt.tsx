import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Shows a one-time banner on mobile web browsers prompting the user to
// add MailPilotus to their home screen, with instructions specific to
// iOS (Safari) or Android (Chrome). Does nothing on native app builds
// or desktop browsers. Remembers if the user dismissed it so it won't
// show again on that device.

const DISMISS_KEY = 'mailpilotus_homescreen_prompt_dismissed';

function isStandalone(): boolean {
  if (Platform.OS !== 'web') return false;
  // iOS Safari
  // @ts-ignore - navigator.standalone is iOS-only, not in TS lib
  if (window.navigator && window.navigator.standalone) return true;
  // Android/Chrome PWA installed
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return false;
}

function getMobilePlatform(): 'ios' | 'android' | null {
  if (Platform.OS !== 'web') return null;
  const ua = window.navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

export default function HomeScreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [mobilePlatform, setMobilePlatform] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const already = window.localStorage.getItem(DISMISS_KEY);
    if (already) return;
    if (isStandalone()) return;
    const plat = getMobilePlatform();
    if (!plat) return; // desktop browser, don't show
    setMobilePlatform(plat);
    setVisible(true);
  }, []);

  if (!visible || !mobilePlatform) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const message =
    mobilePlatform === 'ios'
      ? 'Add MailPilotus to your Home Screen: tap the Share icon in your browser, then scroll down and tap "Add to Home Screen."'
      : 'Add MailPilotus to your Home Screen: tap the menu (⋮) above, then "Add to Home screen" or "Install app."';

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity onPress={dismiss} style={styles.dismissButton}>
        <Text style={styles.dismissText}>Got it</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#0f2138',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  dismissButton: {
    backgroundColor: '#2170e8',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  dismissText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});