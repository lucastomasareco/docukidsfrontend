import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';

// Botón de la barra de arriba: signo de pregunta + el texto "¿Cómo se usa?".
// Abre la guía de la pantalla (ventana centrada). Con la guía abierta, la ventana
// tapa la pantalla; se cierra con su botón "Cerrar" o tocando afuera.
export default function BotonAyuda() {
  const { tema } = useTheme();
  const { alternar } = useAyuda();

  return (
    <TouchableOpacity
      style={[styles.boton, { backgroundColor: tema.primary }]}
      onPress={alternar}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Abrir la guía de esta pantalla"
    >
      <Ionicons name="help-circle-outline" size={22} color={tema.textPrimary} />
      <Text style={[styles.texto, { color: tema.textPrimary }]}>¿Cómo se usa?</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  boton: {
    marginRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  texto: { fontSize: 15, fontWeight: '700' },
});
