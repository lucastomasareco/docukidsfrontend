import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colorConOpacidad } from '../lib/fechas';

const TEXTO = '#1F1F1F';

type Props = {
  nombre: string;
  cantidad: number;
  abierta: boolean;
  onPress: () => void;
  onLongPress: () => void;
  // true mientras se arrastra un documento por encima: indica "se va a guardar acá".
  resaltada?: boolean;
};

// Título de una carpeta en Docs. Es más bajo y liviano que el botón SUBIR DOCUMENTO
// (sin relleno fuerte, con borde y un tinte del color del tema) para que se note
// que es un título para ordenar y no un botón de acción.
export default function EncabezadoCarpeta({ nombre, cantidad, abierta, onPress, onLongPress, resaltada = false }: Props) {
  const { tema } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.fila,
        { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, resaltada ? 0.55 : 0.22) },
        resaltada && styles.resaltada,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Carpeta ${nombre}, ${cantidad} ${cantidad === 1 ? 'documento' : 'documentos'}, ${abierta ? 'abierta' : 'cerrada'}`}
      accessibilityHint="Tocá para abrir o cerrar. Mantené presionado para cambiarle el nombre"
    >
      <Ionicons name={abierta ? 'folder-open-outline' : 'folder-outline'} size={22} color={TEXTO} />
      <Text style={styles.nombre} numberOfLines={1}>
        {nombre}
      </Text>
      <View style={[styles.contador, { backgroundColor: tema.primary }]}>
        <Text style={styles.contadorTexto}>{cantidad}</Text>
      </View>
      <Ionicons name={abierta ? 'chevron-down' : 'chevron-forward'} size={20} color={TEXTO} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 6,
    marginBottom: 8,
  },
  resaltada: { borderWidth: 3 },
  nombre: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXTO },
  contador: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { fontSize: 13, fontWeight: 'bold', color: TEXTO },
});
