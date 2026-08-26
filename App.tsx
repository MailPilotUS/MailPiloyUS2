import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './contexts/SessionContext';
import RootNavigator from './navigation/RootNavigator';
import PushRegistrar from './components/PushRegistrar';

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <PushRegistrar />
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}