import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';

// Botón de la barra de arriba que abre la guía de la pantalla. Es una "pastilla" del
// color del tema, con texto (antes era solo un "?" y casi nadie lo veía).
// En el teléfono el texto es corto ("¿Cómo se usa?") para que no tape el título;
// la ventana de la guía aclara que es solo de esa pantalla.
// En la versión web/escritorio sobra lugar y dice "¿Cómo se usa esta pantalla?".
export default function BotonAyuda() {
  const { tema } = useTheme();
  const { alternar } = useAyuda();
  const texto = Platform.OS === 'web' ? '¿Cómo se usa esta pantalla?' : '¿Cómo se usa?';

  return (
    <TouchableOpacity
      style={[styles.boton, { backgroundColor: tema.primary }]}
      onPress={alternar}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Abrir la guía de esta pantalla"
    >
      <Ionicons name="help-circle-outline" size={20} color="#1F1F1F" />
      <Text style={styles.texto} numberOfLines={1}>{texto}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  boton: {
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  texto: { fontSize: 14, fontWeight: 'bold', color: '#1F1F1F' },
});
