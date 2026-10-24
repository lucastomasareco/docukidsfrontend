import { Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ChildrenProvider } from '../context/ChildrenContext';
import { ThemeProvider } from '../context/ThemeContext';
import AvisosProvider from '../components/AvisosProvider';

function RaizConGuardias() {
  const { session, cargando, enRecuperacion } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;

    const enGrupoAuth = segments[0] === '(auth)';

    if (!session && !enGrupoAuth) {
      router.replace('/(auth)/login');
    } else if (session && enGrupoAuth && !enRecuperacion) {
      router.replace('/(tabs)');
    }
  }, [session, cargando, segments, enRecuperacion]);

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
      <ThemeProvider>
        <ChildrenProvider>
          <AvisosProvider>
            <RaizConGuardias />
          </AvisosProvider>
        </ChildrenProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

// Si una pantalla falla al dibujarse, Expo Router muestra esto en vez de dejar la app en blanco.
// No usa el tema ni los contextos: cuando esto aparece, los proveedores ya no están disponibles.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F5F7FA' }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: '#FFF4E0',
          borderWidth: 2,
          borderColor: '#7FD1D1',
          borderRadius: 24,
          paddingHorizontal: 22,
          paddingVertical: 26,
          maxWidth: 480,
          width: '100%',
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1F1F1F', textAlign: 'center', marginBottom: 8 }}>
          Algo salió mal
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 24, color: '#3F3F3F', textAlign: 'center' }}>
          Tuvimos un problema al mostrar esta pantalla. Probá de nuevo; si sigue pasando, cerrá y volvé a abrir Docukids.
        </Text>
        <TouchableOpacity
          onPress={retry}
          activeOpacity={0.8}
          accessibilityLabel="Reintentar"
          style={{ marginTop: 20, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 3, borderColor: '#7FD1D1', backgroundColor: '#7FD1D1' }}
        >
          <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#1F1F1F' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}