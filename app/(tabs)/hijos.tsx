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
import { LinearGradient } from 'expo-linear-gradient';
import { useChildren, type Hijo } from '../../context/ChildrenContext';
import { useTheme } from '../../context/ThemeContext';
import FormularioSuperior from '../../components/FormularioSuperior';

function inicial(nombre: string): string {
  return nombre.charAt(0).toUpperCase();
}

export default function Hijos() {
  const {
    hijos,
    seleccionadoId,
    cargando,
    error,
    seleccionarHijo,
    cargarHijos,
    agregarHijo,
    editarHijo,
    eliminarHijo,
  } = useChildren();
  const { tema } = useTheme();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hijoEditando, setHijoEditando] = useState<Hijo | null>(null);

  useFocusEffect(
    useCallback(() => {
      cargarHijos();
    }, [cargarHijos])
  );

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setNombreNuevo('');
    setHijoEditando(null);
  };

  const handleGuardar = async () => {
    if (!nombreNuevo.trim()) {
      Alert.alert('Falta el nombre', 'Escribí un nombre antes de guardar.');
      return;
    }
    setGuardando(true);
    const { error } = hijoEditando
      ? await editarHijo(hijoEditando.id, nombreNuevo.trim())
      : await agregarHijo(nombreNuevo.trim());
    setGuardando(false);
    if (error) {
      Alert.alert('No se pudo guardar', error);
      return;
    }
    cerrarFormulario();
  };

  const abrirRenombrar = (hijo: Hijo) => {
    setHijoEditando(hijo);
    setNombreNuevo(hijo.name);
    setMostrarFormulario(true);
  };

  const confirmarEliminar = (hijo: Hijo) => {
    Alert.alert(
      `Eliminar a ${hijo.name}`,
      'Esto borra también sus documentos y sus turnos guardados. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await eliminarHijo(hijo.id);
            if (error) Alert.alert('No se pudo eliminar', error);
          },
        },
      ]
    );
  };

  const abrirMenu = (hijo: Hijo) => {
    Alert.alert(hijo.name, '¿Qué querés hacer?', [
      { text: 'Cambiar nombre', onPress: () => abrirRenombrar(hijo) },
      { text: 'Eliminar hijo', style: 'destructive', onPress: () => confirmarEliminar(hijo) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
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
        <TouchableOpacity style={[styles.botonReintentar, { backgroundColor: tema.primary }]} onPress={cargarHijos}>
          <Text style={styles.botonTexto}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient 
      colors={tema.backgroundGradient} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 1 }} 
      style={styles.container}
    >
      {hijos.length === 0 && (
        <Text style={styles.textoGuiaSuave}>Creá el perfil de tu hijo</Text>
      )}

      {!mostrarFormulario && (
        <TouchableOpacity
          style={[styles.botonAgendarGrande, { backgroundColor: tema.primary }]}
          onPress={() => setMostrarFormulario(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.botonAgendarGrandeTexto}>👶  Registrar hijo</Text>
        </TouchableOpacity>
      )}

      {hijos.length > 0 && (
        <Text style={styles.ayuda}>Mantené presionado un hijo para cambiarle el nombre o eliminarlo.</Text>
      )}

      {hijos.length === 0 ? null : (
        <FlatList
          data={hijos}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const seleccionado = item.id === seleccionadoId;
            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  seleccionado && { backgroundColor: tema.bar, borderWidth: 1.5, borderColor: tema.primary },
                ]}
                onPress={() => seleccionarHijo(item.id)}
                onLongPress={() => abrirMenu(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, seleccionado && { backgroundColor: tema.primary }]}>
                  <Text style={styles.avatarTexto}>{inicial(item.name)}</Text>
                </View>
                <View>
                  <Text style={styles.nombre}>{item.name}</Text>
                  {item.birth_date && <Text style={styles.fecha}>Nacido: {item.birth_date}</Text>}
                </View>
                {seleccionado && <Text style={[styles.check, { color: tema.primary }]}>✓</Text>}
              </TouchableOpacity>
            );
          }}
        />
      )}
      {mostrarFormulario && (
        <FormularioSuperior>
          <Text style={styles.formularioTitulo}>
            {hijoEditando ? 'Cambiar nombre' : 'Nuevo hijo'}
          </Text>
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder="Nombre del hijo/a"
            value={nombreNuevo}
            onChangeText={setNombreNuevo}
            autoFocus
          />
          <View style={styles.filaBotones}>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonCancelar]}
              onPress={cerrarFormulario}
              disabled={guardando}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar, { backgroundColor: tema.primary }]}
              onPress={handleGuardar}
              disabled={guardando}
            >
              <Text style={styles.botonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
        </FormularioSuperior>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  textoCargando: { fontSize: 16, textAlign: 'center', marginTop: 12, color: '#3F3F3F' },
  textoError: { fontSize: 16, textAlign: 'center', color: '#b71c1c', marginBottom: 12 },
  botonReintentar: { backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  textoGuiaSuave: { fontSize: 16, color: '#3F3F3F', marginTop: 0, marginBottom: 14 },
  ayuda: { fontSize: 14, color: '#3F3F3F', marginBottom: 8 },
  botonAgendarGrande: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  botonAgendarGrandeTexto: { color: '#1F1F1F', fontSize: 20, fontWeight: 'bold' },
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
  avatarTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 20 },
  nombre: { fontSize: 18, fontWeight: '600' },
  fecha: { fontSize: 15, color: '#3F3F3F' },
  check: { marginLeft: 'auto', fontSize: 20, color: '#1976d2', fontWeight: 'bold' },
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  formularioTitulo: { fontSize: 17, fontWeight: 'bold', marginBottom: 10, color: '#1F1F1F' },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#D0D0D0' },
  botonGuardar: { backgroundColor: '#1976d2' },
  botonTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
});