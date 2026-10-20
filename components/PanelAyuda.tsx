import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';
import { AYUDAS } from '../lib/ayudas';

const TEXTO = '#1F1F1F';
const TEXTO_SUAVE = '#3F3F3F';
// Color propio de la guía (distinto al de las tarjetas de la app) para que se note.
const FONDO_AYUDA = '#EAF0FF';

// Ventana con la guía de la pantalla actual: centrada, con fondo oscurecido.
// Se cierra con el botón "Cerrar", tocando afuera o con el botón "atrás" de Android.
// Como tapa la pantalla, no se superpone con ningún otro cartel.
export default function PanelAyuda() {
  const { tema } = useTheme();
  const { pantalla, abierta, alternar } = useAyuda();
  const { height } = useWindowDimensions();

  if (!abierta || !pantalla) return null;
  const ayuda = AYUDAS[pantalla];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={alternar}>
      <View style={styles.centro}>
        {/* Fondo oscuro: tocarlo cierra la guía. */}
        <Pressable style={styles.fondo} onPress={alternar} accessibilityLabel="Cerrar la guía" />

        <View style={[styles.tarjeta, { backgroundColor: FONDO_AYUDA, borderColor: tema.primary, maxHeight: height * 0.8 }]}>
          {/* ScrollView por si la letra del teléfono está en "grande". */}
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.cabecera}>
              <View style={[styles.circulo, { backgroundColor: tema.primary }]}>
                <Ionicons name="help" size={22} color={TEXTO} />
              </View>
              <Text style={styles.titulo}>{ayuda.titulo}</Text>
            </View>

            <View style={[styles.aviso, { borderColor: tema.primary }]}>
              <Ionicons name="information-circle-outline" size={20} color={TEXTO} style={styles.icono} />
              <Text style={styles.avisoTexto}>
                Esta guía es solo de la pantalla {ayuda.nombre}. Cada pantalla tiene la suya: buscá el botón "¿Cómo se usa esta pantalla?" arriba a la derecha.
              </Text>
            </View>

            {ayuda.consejos.map((c, i) => (
              <View key={i} style={styles.fila}>
                <Ionicons name={c.icono} size={22} color={TEXTO} style={styles.icono} />
                <Text style={styles.texto}>{c.texto}</Text>
              </View>
            ))}

            <Text style={styles.pie}>Para cerrarla tocá "Cerrar" o cualquier parte de afuera. Podés volver a verla cuando quieras con el botón "¿Cómo se usa esta pantalla?" de arriba.</Text>
          </ScrollView>

          <TouchableOpacity
            style={[styles.botonCerrar, { backgroundColor: tema.primary }]}
            onPress={alternar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar la guía"
          >
            <Text style={styles.textoCerrar}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  fondo: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  tarjeta: { width: '100%', maxWidth: 560, borderRadius: 20, borderWidth: 2, paddingHorizontal: 20, paddingVertical: 18 },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  circulo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  titulo: { flex: 1, fontSize: 20, fontWeight: 'bold', color: TEXTO },
  aviso: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderRadius: 12, padding: 10, marginTop: 8 },
  avisoTexto: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '600', color: TEXTO },
  fila: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 },
  icono: { marginRight: 10, marginTop: 1 },
  texto: { flex: 1, fontSize: 16, lineHeight: 22, color: TEXTO_SUAVE },
  pie: { fontSize: 13, lineHeight: 18, color: TEXTO_SUAVE, marginTop: 14, fontStyle: 'italic' },
  botonCerrar: { alignSelf: 'flex-end', marginTop: 16, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 12 },
  textoCerrar: { fontSize: 16, fontWeight: 'bold', color: TEXTO },
});
