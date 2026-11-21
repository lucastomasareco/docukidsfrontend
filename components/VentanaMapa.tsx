import { Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapaLugar from './MapaLugar';
import { useTheme } from '../context/ThemeContext';
import { enlaceComoLlegar, Lugar, tieneUbicacion, tituloDeLugar } from '../lib/lugares';

// Ventana con el mapa de un turno (solo lectura: se puede mirar y moverse, no cambia el lugar).
// Tocar fuera de la ventana, o "Cerrar", la cierra.
type Props = { lugar: Lugar; onCerrar: () => void };

export default function VentanaMapa({ lugar, onCerrar }: Props) {
  const { tema } = useTheme();
  const enlace = enlaceComoLlegar(lugar);
  const titulo = tituloDeLugar(lugar);
  const mostrarDireccion = lugar.direccion.trim() && lugar.direccion.trim() !== titulo;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={styles.fondo} onPress={onCerrar} accessibilityLabel="Cerrar el mapa">
        <Pressable style={[styles.caja, { backgroundColor: tema.card }]} onPress={() => {}}>
          <View style={styles.encabezado}>
            <Ionicons name="location" size={24} color="#1F1F1F" />
            <Text style={styles.titulo} numberOfLines={2}>{titulo}</Text>
          </View>
          {mostrarDireccion ? <Text style={styles.direccion}>{lugar.direccion}</Text> : null}

          {tieneUbicacion(lugar) ? (
            <MapaLugar lat={lugar.lat} lon={lugar.lon} altura={320} />
          ) : (
            <Text style={styles.sinMapa}>
              Este turno tiene la dirección escrita, pero no un punto marcado en el mapa. Igual podés usar “Cómo llegar”.
            </Text>
          )}

          {enlace && (
            <TouchableOpacity
              style={[styles.boton, { backgroundColor: tema.primary, borderColor: tema.primary }]}
              onPress={() => Linking.openURL(enlace)}
              activeOpacity={0.8}
              accessibilityLabel="Cómo llegar, abre Google Maps"
            >
              <Ionicons name="navigate" size={20} color="#1F1F1F" />
              <Text style={styles.textoBoton}>Cómo llegar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.boton, { borderColor: tema.primary }]}
            onPress={onCerrar}
            activeOpacity={0.8}
            accessibilityLabel="Cerrar"
          >
            <Text style={styles.textoBoton}>Cerrar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  caja: { width: '100%', maxWidth: 560, borderRadius: 24, padding: 18, elevation: 10 },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  titulo: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1F1F1F' },
  direccion: { fontSize: 15, color: '#3F3F3F', marginBottom: 10 },
  sinMapa: { fontSize: 15, color: '#3F3F3F', marginVertical: 12 },
  boton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 3, marginTop: 12 },
  textoBoton: { fontSize: 18, fontWeight: 'bold', color: '#1F1F1F' },
});
