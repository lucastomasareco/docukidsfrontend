import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { NombreIcono } from './AvisoError';

// Estado VACÍO: la carga salió bien y simplemente no hay nada todavía.
// Es una invitación a hacer algo, no un problema. Por eso usa los mismos colores
// del tema que TarjetaError pero con tono amable y un botón solo si hace falta.
// (Si la carga FALLÓ, se muestra TarjetaError, nunca esto.)

type Props = {
  icono: NombreIcono;
  titulo: string;
  mensaje: string;
  // El botón es opcional: solo va cuando la pantalla no tiene ya un botón
  // visible para esa misma acción (evita mostrar dos iguales).
  etiquetaAccion?: string;
  onAccion?: () => void;
  // 'compacta' para vacíos pequeños dentro de una lista (ej. "ese día no tiene turnos").
  variante?: 'grande' | 'compacta';
};

const TEXTO = '#1F1F1F';
const TEXTO_SUAVE = '#3F3F3F';

export default function EstadoVacio({ icono, titulo, mensaje, etiquetaAccion, onAccion, variante = 'grande' }: Props) {
  const { tema } = useTheme();
  const conBoton = Boolean(etiquetaAccion && onAccion);

  if (variante === 'compacta') {
    return (
      <View style={[styles.compacta, { backgroundColor: tema.card, borderColor: tema.primary }]}>
        <View style={[styles.circuloChico, { backgroundColor: tema.primary }]}>
          <Ionicons name={icono} size={22} color={TEXTO} />
        </View>
        <View style={styles.textos}>
          <Text style={styles.tituloChico}>{titulo}</Text>
          {mensaje ? <Text style={styles.mensajeChico}>{mensaje}</Text> : null}
          {conBoton && (
            <TouchableOpacity
              style={[styles.botonChico, { backgroundColor: tema.primary, borderColor: tema.primary }]}
              onPress={onAccion}
              activeOpacity={0.8}
              accessibilityLabel={etiquetaAccion}
            >
              <Text style={styles.textoBotonChico}>{etiquetaAccion}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.grande, { backgroundColor: tema.card, borderColor: tema.primary }]}>
      <View style={[styles.circuloGrande, { backgroundColor: tema.primary }]}>
        <Ionicons name={icono} size={38} color={TEXTO} />
      </View>
      <Text style={styles.tituloGrande}>{titulo}</Text>
      <Text style={styles.mensajeGrande}>{mensaje}</Text>
      {conBoton && (
        <TouchableOpacity
          style={[styles.botonGrande, { backgroundColor: tema.primary, borderColor: tema.primary }]}
          onPress={onAccion}
          activeOpacity={0.8}
          accessibilityLabel={etiquetaAccion}
        >
          <Text style={styles.textoBotonGrande}>{etiquetaAccion}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grande: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginHorizontal: 4,
    marginTop: 20,
  },
  circuloGrande: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  tituloGrande: { fontSize: 22, fontWeight: 'bold', color: TEXTO, textAlign: 'center', marginBottom: 8 },
  mensajeGrande: { fontSize: 17, lineHeight: 24, color: TEXTO_SUAVE, textAlign: 'center' },
  botonGrande: { marginTop: 20, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 3 },
  textoBotonGrande: { fontSize: 19, fontWeight: 'bold', color: TEXTO },

  compacta: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 2, borderRadius: 14, padding: 12, marginTop: 16 },
  circuloChico: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1 },
  tituloChico: { fontSize: 17, fontWeight: 'bold', color: TEXTO },
  mensajeChico: { fontSize: 15, lineHeight: 21, color: TEXTO_SUAVE, marginTop: 2 },
  botonChico: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10, borderWidth: 2 },
  textoBotonChico: { fontSize: 16, fontWeight: 'bold', color: TEXTO },
});
