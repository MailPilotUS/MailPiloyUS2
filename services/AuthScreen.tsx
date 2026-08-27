import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { useSession } from '../contexts/SessionContext';
import { api } from '../services/api';
import { colors } from '../theme';

export default function AuthScreen() {
  const { login, signup } = useSession();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('token')) return 'reset';
      if (params.get('mode') === 'login') return 'login';
    }
    return 'signup';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const PRICE_IDS: Record<string, string> = {
  'pro-monthly': 'price_1Tx4i6FZ1VLALyugBjZvOONs',
  'pro-annual': 'price_1Tx5MYFZ1VLALyugWErltx9a',
};
const resetToken =
  Platform.OS === 'web' ? new URLSearchParams(window.location.search).get('token') || '' : '';

const submit = async () => {
  setLoading(true);
  try {
    if (mode === 'signup') await signup(email, password);
    else await login(email, password);
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      const plan = params.get('plan');
      if (plan && PRICE_IDS[plan]) {
        const { url } = await api.createCheckoutSession(PRICE_IDS[plan]);
        window.location.href = url;
        return;
      }
    }
  } catch (e: any) {
    Alert.alert('Something went wrong', e.message);
  } finally {
    setLoading(false);
  }
};

const submitForgotPassword = async () => {
  setLoading(true);
  try {
    await api.forgotPassword(email);
    Alert.alert(
      'Check your email',
      'If an account exists with that email, a reset link has been sent.'
    );
    setMode('login');
  } catch (e: any) {
    Alert.alert('Something went wrong', e.message);
  } finally {
    setLoading(false);
  }
};

const submitResetPassword = async () => {
  if (password !== confirmPassword) {
    Alert.alert('Passwords do not match', 'Please make sure both passwords match.');
    return;
  }
  setLoading(true);
  try {
    await api.resetPassword(resetToken, password);
    Alert.alert('Password updated', 'You can now log in with your new password.');
    if (Platform.OS === 'web') {
      window.location.href = window.location.pathname + '?mode=login';
    } else {
      setMode('login');
    }
  } catch (e: any) {
    Alert.alert('Something went wrong', e.message);
  } finally {
    setLoading(false);
  }
};

  if (mode === 'forgot') {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/mailpilotus-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.formWrap}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.navyFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TouchableOpacity style={styles.cta} onPress={submitForgotPassword} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Send reset link</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('login')}>
            <Text style={styles.switch}>Back to log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'reset') {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/mailpilotus-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.formWrap}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter a new password"
            placeholderTextColor={colors.navyFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your new password"
            placeholderTextColor={colors.navyFaint}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity style={styles.cta} onPress={submitResetPassword} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Reset password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/mailpilotus-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.formWrap}>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.navyFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
          placeholderTextColor={colors.navyFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.cta} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text>
          )}
        </TouchableOpacity>
        {mode === 'login' && (
          <TouchableOpacity onPress={() => setMode('forgot')}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
          <Text style={styles.switch}>
            {mode === 'signup' ? 'Already have an account? Log in' : "New here? Create an account"}
          </Text>
        </TouchableOpacity>
        {Platform.OS === 'web' && (
          <Text style={styles.bookmarkTip}>
            Tip: bookmark this page (Ctrl+D, or Cmd+D on Mac) for quick access next time.
          </Text>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, padding: 28, justifyContent: 'center' },
  logo: { width: 220, height: 220, alignSelf: 'center', marginBottom: 24 },
  formWrap: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    marginBottom: 14,
    fontSize: 15,
  },
  cta: {
    backgroundColor: colors.blue,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switch: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 20, fontSize: 13.5 },
  forgotLink: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 14,
    fontSize: 13.5,
  },
  bookmarkTip: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    lineHeight: 17,
  },
});
