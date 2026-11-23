import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colorConOpacidad } from '../lib/fechas';

const TEXTO = '#1F1F1F';

type Props = {
  nombre: string;
  cantidad: number;
  seleccionada: boolean;
  onPress: () => void;
  // Mantener presionado: renombrar o borrar la carpeta (igual que en el celular). "A la vista" no lo tiene.
  onLongPress?: () => void;
  icono?: 'folder-outline' | 'eye-outline';
};

// Carpeta del panel izquierdo (pantalla ancha). Tocarla muestra sus documentos en el panel derecho.
export default function ItemCarpetaLateral({ nombre, cantidad, seleccionada, onPress, onLongPress, icono = 'folder-outline' }: Props) {
  const { tema } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.fila,
        { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, seleccionada ? 0.6 : 0.18) },
        seleccionada && styles.seleccionada,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionada }}
      accessibilityLabel={`${nombre}, ${cantidad} ${cantidad === 1 ? 'documento' : 'documentos'}${seleccionada ? ', seleccionada' : ''}`}
      accessibilityHint={onLongPress ? 'Tocá para ver sus documentos. Mantené presionado para cambiarle el nombre' : 'Tocá para ver sus documentos'}
    >
      <Ionicons name={seleccionada && icono === 'folder-outline' ? 'folder-open-outline' : icono} size={22} color={TEXTO} />
      <Text style={[styles.nombre, seleccionada && styles.nombreSeleccionada]} numberOfLines={1}>
        {nombre}
      </Text>
      <View style={[styles.contador, { backgroundColor: tema.primary }]}>
        <Text style={styles.contadorTexto}>{cantidad}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  seleccionada: { borderWidth: 3, paddingVertical: 8.5, paddingHorizontal: 10.5 },
  nombre: { flex: 1, fontSize: 16, fontWeight: '600', color: TEXTO },
  nombreSeleccionada: { fontWeight: '800' },
  contador: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { fontSize: 13, fontWeight: 'bold', color: TEXTO },
});
