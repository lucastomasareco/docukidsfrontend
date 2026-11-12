import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colorConOpacidad } from '../lib/fechas';
import MenuAcciones, { AccionMenu } from './MenuAcciones';

const TEXTO = '#1F1F1F';

type Props = {
  nombre: string;
  cantidad: number;
  abierta: boolean;
  onPress: () => void;
  acciones?: AccionMenu[];
  resaltada?: boolean;
};

export default function EncabezadoCarpeta({ nombre, cantidad, abierta, onPress, acciones = [], resaltada = false }: Props) {
  const { tema } = useTheme();
  return (
    <View
      style={[
        styles.fila,
        { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, resaltada ? 0.55 : 0.22) },
        resaltada && styles.resaltada,
      ]}
    >
      <TouchableOpacity
        style={styles.zonaToque}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Carpeta ${nombre}, ${cantidad} ${cantidad === 1 ? 'documento' : 'documentos'}, ${abierta ? 'abierta' : 'cerrada'}`}
        accessibilityHint="Tocá para abrir o cerrar"
      >
        <Ionicons name={abierta ? 'folder-open-outline' : 'folder-outline'} size={22} color={TEXTO} />
        <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
        <View style={[styles.contador, { backgroundColor: tema.primary }]}>
          <Text style={styles.contadorTexto}>{cantidad}</Text>
        </View>
        <Ionicons name={abierta ? 'chevron-down' : 'chevron-forward'} size={20} color={TEXTO} />
      </TouchableOpacity>
      {acciones.length > 0 && <MenuAcciones etiquetaAccesible={`Acciones de la carpeta ${nombre}`} acciones={acciones} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 6,
    marginBottom: 8,
  },
  zonaToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resaltada: { borderWidth: 3 },
  nombre: { flex: 1, fontSize: 16, fontWeight: '700', color: TEXTO },
  contador: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { fontSize: 13, fontWeight: 'bold', color: TEXTO },
});