import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';

// Botón "?" de la barra de arriba: un círculo del color del tema que eligió la
// persona en Ajustes, con el signo de pregunta adentro. Abre la guía de la
// pantalla (ventana centrada, que se cierra con su botón "Cerrar" o tocando afuera).
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
      <Ionicons name="help" size={22} color="#1F1F1F" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  boton: { marginRight: 14, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
