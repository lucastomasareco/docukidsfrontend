import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';

// Botón "?" de la barra de arriba. Abre la guía de la pantalla; con la guía
// abierta, el mismo botón la cierra y muestra "cerrar" en chiquito debajo.
// El texto ocupa siempre su lugar (invisible si está cerrada) para que el
// ícono no salte de posición al abrir o cerrar.
export default function BotonAyuda() {
  const { tema } = useTheme();
  const { abierta, alternar } = useAyuda();

  return (
    <TouchableOpacity
      style={styles.boton}
      onPress={alternar}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={abierta ? 'Cerrar la guía' : 'Abrir la guía de esta pantalla'}
    >
      <Ionicons name={abierta ? 'help-circle' : 'help-circle-outline'} size={28} color={tema.textPrimary} />
      <Text
        style={[styles.cerrar, { color: tema.textSecondary, opacity: abierta ? 1 : 0 }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        cerrar
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  boton: { marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  cerrar: { fontSize: 11, lineHeight: 13, fontWeight: '600' },
});
