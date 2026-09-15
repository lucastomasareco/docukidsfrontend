import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ChildrenProvider } from '../context/ChildrenContext';


function RaizConGuardias() {
  const { session, cargando } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;

    const enGrupoAuth = segments[0] === '(auth)';

    if (!session && !enGrupoAuth) {
      router.replace('/(auth)/login');
    } else if (session && enGrupoAuth) {
      router.replace('/(tabs)');
    }
  }, [session, cargando, segments]);

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ChildrenProvider>
        <RaizConGuardias />
      </ChildrenProvider>
    </AuthProvider>
  );
}