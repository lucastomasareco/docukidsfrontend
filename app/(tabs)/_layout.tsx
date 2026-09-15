import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const ICONOS: Record<string, { activo: any; inactivo: any }> = {
  index: { activo: 'document-text', inactivo: 'document-text-outline' },
  calendario: { activo: 'calendar', inactivo: 'calendar-outline' },
  hijos: { activo: 'people', inactivo: 'people-outline' },
  ajustes: { activo: 'settings', inactivo: 'settings-outline' },
};

function crearIcono(pantalla: keyof typeof ICONOS) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons
      name={focused ? ICONOS[pantalla].activo : ICONOS[pantalla].inactivo}
      size={24}
      color={color}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#757575',
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Docs', tabBarIcon: crearIcono('index') }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendario', tabBarIcon: crearIcono('calendario') }} />
      <Tabs.Screen name="hijos" options={{ title: 'Hijos', tabBarIcon: crearIcono('hijos') }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: crearIcono('ajustes') }} />
    </Tabs>
  );
}