import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';

// Botón de la barra de arriba que abre la guía de la pantalla. Es una "pastilla" del
// color del tema, con texto (antes era solo un "?" y casi nadie lo veía).
// Dice "¿Cómo se usa esta pantalla?" en el teléfono y en escritorio, para que se
// entienda que la guía es de la pantalla donde la persona está.
export default function BotonAyuda() {
  const { tema } = useTheme();
  const { alternar } = useAyuda();

  return (
    <TouchableOpacity
      style={[styles.boton, { backgroundColor: tema.primary }]}
      onPress={alternar}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Abrir la guía de esta pantalla"
    >
      <Text style={styles.texto} numberOfLines={1}>¿Cómo se usa esta pantalla?</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  boton: { marginRight: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 18 },
  // Letra chica a propósito: en el teléfono tiene que entrar junto al título.
  texto: { fontSize: 12.5, fontWeight: 'bold', color: '#1F1F1F' },
});
