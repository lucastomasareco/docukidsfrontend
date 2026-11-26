import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChildren } from '../context/ChildrenContext';
import { useTheme } from '../context/ThemeContext';
import useTelefono from '../lib/useTelefono';
import {
  MAX_NOMBRE_HIJOS,
  NOMBRE_HIJOS_POR_DEFECTO,
  SUGERENCIAS_NOMBRE_HIJOS,
  tituloDeHijos,
} from '../lib/nombreHijos';

// Título de la pantalla Hijos, en la barra de arriba. Lleva un lápiz (como el botón "Editar")
// y al tocarlo la persona cambia el nombre: "Mis hijas", "Mis peludos", "Mis abuelos"...
// El "Mis" es fijo: solo se escribe lo que va después. El mismo nombre se ve en la barra de abajo.
// Docukids tiene un foco (el cuidado parental) pero un alcance amplio.
export default function TituloHijos() {
  const { nombreHijos, cambiarNombreHijos } = useChildren();
  const { tema } = useTheme();
  const telefono = useTelefono();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nombreHijos);

  const abrir = () => {
    setTexto(nombreHijos);
    setEditando(true);
  };
  const guardar = () => {
    cambiarNombreHijos(texto);
    setEditando(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={abrir}
        style={styles.fila}
        accessibilityRole="button"
        accessibilityLabel={`Cambiar el nombre de la pantalla "${tituloDeHijos(nombreHijos)}"`}
      >
        <Text
          numberOfLines={1}
          style={{ fontSize: telefono ? 20 : 21, fontWeight: 'bold', color: tema.textPrimary, flexShrink: 1 }}
        >
          {tituloDeHijos(nombreHijos)}
        </Text>
        <Ionicons name="pencil-outline" size={telefono ? 16 : 18} color={tema.textSecondary} />
      </TouchableOpacity>

      <Modal visible={editando} transparent animationType="fade" onRequestClose={() => setEditando(false)}>
        <View style={styles.capa}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditando(false)} accessibilityLabel="Cerrar" />
          <View style={styles.tarjeta}>
            <Text style={styles.titulo}>¿Cómo querés llamarlos?</Text>
            {/* "Mis" va fijo: la persona solo escribe lo que sigue. */}
            <View style={styles.filaInput}>
              <Text style={styles.prefijo}>Mis</Text>
              <TextInput
                style={styles.input}
                value={texto}
                onChangeText={setTexto}
                maxLength={MAX_NOMBRE_HIJOS}
                placeholder={NOMBRE_HIJOS_POR_DEFECTO}
                placeholderTextColor="#5F5F5F"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={guardar}
              />
            </View>
            <View style={styles.sugerencias}>
              {SUGERENCIAS_NOMBRE_HIJOS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, { borderColor: tema.primary }]}
                  onPress={() => setTexto(s)}
                >
                  <Text style={styles.chipTexto}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filaBotones}>
              <TouchableOpacity style={[styles.boton, styles.botonCancelar]} onPress={() => setEditando(false)}>
                <Text style={styles.botonTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.boton, { backgroundColor: tema.primary }]} onPress={guardar}>
                <Text style={styles.botonTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  capa: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', paddingTop: 80, paddingHorizontal: 16 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%', maxWidth: 480, alignSelf: 'center', elevation: 6 },
  titulo: { fontSize: 17, fontWeight: 'bold', marginBottom: 10, color: '#1F1F1F' },
  filaInput: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  prefijo: { fontSize: 18, fontWeight: 'bold', color: '#1F1F1F' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16, color: '#1F1F1F' },
  sugerencias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5 },
  chipTexto: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  boton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#D0D0D0' },
  botonTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
});
