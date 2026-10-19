import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useChildren } from '../../context/ChildrenContext';
import { AyudaProvider } from '../../context/AyudaContext';
import BotonAyuda from '../../components/BotonAyuda';
import PanelAyuda from '../../components/PanelAyuda';

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
  const { tema } = useTheme();
  const { hijos, seleccionadoId } = useChildren();
  // Con un hijo elegido, el título de la barra lleva su nombre. Si no hay, el título de siempre.
  const nombreHijo = hijos.find((h) => h.id === seleccionadoId)?.name;

  return (
    <AyudaProvider>
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        // Botón "?" de la guía, en la barra de arriba de las 4 pestañas.
        headerRight: () => <BotonAyuda />,
        // Barra de arriba: blanca (la de siempre); solo cambia el estilo del título.
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 21, fontWeight: 'bold', color: tema.textPrimary },
        tabBarActiveTintColor: tema.primary,
        tabBarInactiveTintColor: tema.textSecondary,
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
      }}
    >
      {/* "title" es el nombre corto de la barra de abajo; "headerTitle" es el de arriba. */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Docs', headerTitle: nombreHijo ? `Documentos de ${nombreHijo}` : 'Mis documentos', tabBarIcon: crearIcono('index') }}
      />
      <Tabs.Screen
        name="calendario"
        options={{ title: 'Calendario', headerTitle: nombreHijo ? `Turnos de ${nombreHijo}` : 'Calendario', tabBarIcon: crearIcono('calendario') }}
      />
      <Tabs.Screen
        name="hijos"
        options={{ title: 'Hijos', headerTitle: 'Mis hijos', tabBarIcon: crearIcono('hijos') }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{ title: 'Ajustes', headerTitle: 'Ajustes', tabBarIcon: crearIcono('ajustes') }}
      />
    </Tabs>
    <PanelAyuda />
    </View>
    </AyudaProvider>
  );
}
