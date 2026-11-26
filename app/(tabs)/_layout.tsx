import { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useChildren } from '../../context/ChildrenContext';
import { AyudaProvider } from '../../context/AyudaContext';
import BotonAyuda from '../../components/BotonAyuda';
import PanelAyuda from '../../components/PanelAyuda';
import TituloHijos from '../../components/TituloHijos';
import { etiquetaPestanaHijos } from '../../lib/nombreHijos';
import { migrarDriveEnSegundoPlano } from '../../lib/migrarDrive';
import useTelefono from '../../lib/useTelefono';

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
  const telefono = useTelefono();
  const { hijos, seleccionadoId, nombreHijos } = useChildren();
  // Con un hijo elegido, el título de la barra lleva su nombre. Si no hay, el título de siempre.
  const nombreHijo = hijos.find((h) => h.id === seleccionadoId)?.name;

  // Al entrar a la app, ordena en segundo plano los documentos viejos de Drive (una sola vez).
  useEffect(() => {
    migrarDriveEnSegundoPlano();
  }, []);

  return (
    <AyudaProvider>
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        // Botón "?" de la guía, en la barra de arriba de las 4 pestañas.
        headerRight: () => <BotonAyuda />,
        // Barra de arriba: blanca (la de siempre); solo cambia el estilo del título.
        headerTitleAlign: 'left',
        // Barra de arriba 3 px más baja que la de siempre (64 → 61), en celular y en PC.
        // Para volver a como estaba: borrar esta línea y la siguiente.
        // En teléfono: la mitad de alta (32 px) y la letra 1 px más chica. En PC queda como estaba.
        headerStyle: { height: telefono ? 32 : 61 },
        // Sube el título 2 px para que quede a la misma altura que el botón "¿Cómo se usa esta pantalla?".
        headerTitleContainerStyle: { paddingBottom: telefono ? 0 : 4 },
        headerTitleStyle: { fontSize: telefono ? 20 : 21, fontWeight: 'bold', color: tema.textPrimary },
        tabBarActiveTintColor: tema.primary,
        tabBarInactiveTintColor: tema.textSecondary,
        // En teléfono el ícono va sobre el texto y la barra tiene alto fijo: con letra de 15 px el texto
        // quedaba cortado por abajo. Con 12 px entra completo SIN subir la barra. En PC no cambia.
        tabBarLabelStyle: { fontSize: telefono ? 12 : 15, fontWeight: '600' },
      }}
    >
      {/* "title" es el nombre corto de la barra de abajo; "headerTitle" es el de arriba. */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Docs', headerTitle: nombreHijo ? `${telefono ? 'Docs.' : 'Documentos'} de ${nombreHijo}` : 'Mis documentos', tabBarIcon: crearIcono('index') }}
      />
      <Tabs.Screen
        name="calendario"
        options={{ title: 'Calendario', headerTitle: nombreHijo ? `Turnos de ${nombreHijo}` : 'Calendario', tabBarIcon: crearIcono('calendario') }}
      />
      <Tabs.Screen
        name="hijos"
        /* El nombre de la pestaña de abajo sigue al que la persona eligió ("Hijos" por defecto). */
        options={{ title: etiquetaPestanaHijos(nombreHijos), headerTitle: () => <TituloHijos />, tabBarIcon: crearIcono('hijos') }}
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
