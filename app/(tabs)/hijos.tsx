import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useChildren } from '../../context/ChildrenContext';

function inicial(nombre: string): string {
  return nombre.charAt(0).toUpperCase();
}

export default function Hijos() {
  const { hijos, seleccionadoId, cargando, error, seleccionarHijo, cargarHijos, agregarHijo } =
    useChildren();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      cargarHijos();
    }, [cargarHijos])
  );

  const handleAgregar = async () => {
    if (!nombreNuevo.trim()) {
      Alert.alert('Falta el nombre', 'Escribí un nombre antes de guardar.');
      return;
    }
    setGuardando(true);
    const { error } = await agregarHijo(nombreNuevo.trim());
    setGuardando(false);
    if (error) {
      Alert.alert('No se pudo guardar', error);
      return;
    }
    setNombreNuevo('');
    setMostrarFormulario(false);
  };

  if (cargando && hijos.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
        <Text style={styles.textoCargando}>
          Conectando con el servidor...{'\n'}(puede tardar hasta 1 minuto la primera vez)
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.textoError}>No se pudo cargar: {error}</Text>
        <TouchableOpacity style={styles.botonReintentar} onPress={cargarHijos}>
          <Text style={styles.botonTexto}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mis Hijos</Text>

      {hijos.length === 0 ? (
        <Text style={styles.vacio}>Todavía no agregaste ningún hijo.</Text>
      ) : (
        <FlatList
          data={hijos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const seleccionado = item.id === seleccionadoId;
            return (
              <TouchableOpacity
                style={[styles.card, seleccionado && styles.cardSeleccionada]}
                onPress={() => seleccionarHijo(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, seleccionado && styles.avatarSeleccionado]}>
                  <Text style={styles.avatarTexto}>{inicial(item.name)}</Text>
                </View>
                <View>
                  <Text style={styles.nombre}>{item.name}</Text>
                  {item.birth_date && <Text style={styles.fecha}>Nacido: {item.birth_date}</Text>}
                </View>
                {seleccionado && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {mostrarFormulario && (
        <View style={styles.formulario}>
          <TextInput
            style={styles.input}
            placeholder="Nombre del hijo/a"
            value={nombreNuevo}
            onChangeText={setNombreNuevo}
            autoFocus
          />
          <View style={styles.filaBotones}>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonCancelar]}
              onPress={() => {
                setMostrarFormulario(false);
                setNombreNuevo('');
              }}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar]}
              onPress={handleAgregar}
              disabled={guardando}
            >
              <Text style={styles.botonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!mostrarFormulario && (
        <TouchableOpacity style={styles.fab} onPress={() => setMostrarFormulario(true)}>
          <Text style={styles.fabTexto}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  textoCargando: { textAlign: 'center', marginTop: 12, color: '#666' },
  textoError: { textAlign: 'center', color: '#c62828', marginBottom: 12 },
  botonReintentar: { backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  vacio: { color: '#666', marginTop: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  cardSeleccionada: { backgroundColor: '#e3f2fd', borderWidth: 1.5, borderColor: '#1976d2' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#bdbdbd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSeleccionado: { backgroundColor: '#1976d2' },
  avatarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  nombre: { fontSize: 16, fontWeight: '600' },
  fecha: { fontSize: 13, color: '#666' },
  check: { marginLeft: 'auto', fontSize: 18, color: '#1976d2', fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabTexto: { color: '#fff', fontSize: 28, lineHeight: 30 },
  formulario: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 30,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#999' },
  botonGuardar: { backgroundColor: '#1976d2' },
  botonTexto: { color: '#fff', fontWeight: 'bold' },
});