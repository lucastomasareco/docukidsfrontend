import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChildren, type Hijo } from '../../context/ChildrenContext';
import { useTheme } from '../../context/ThemeContext';
import { useAvisos } from '../../context/AvisosContext';
import { TarjetaError } from '../../components/AvisoError';
import EsperaServidor from '../../components/EsperaServidor';
import EstadoVacio from '../../components/EstadoVacio';
import FormularioSuperior from '../../components/FormularioSuperior';
import { colorConOpacidad } from '../../lib/fechas';

// Para comparar nombres: sin mayúsculas, sin tildes y sin espacios de más.
// Así "Lucía", "lucia" y "LUC" coinciden al buscar.
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

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
  const { mostrarError, mostrarAviso, confirmar } = useAvisos();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [hijoEditando, setHijoEditando] = useState<Hijo | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Buscador: muestra los hijos cuyo nombre EMPIEZA con lo escrito (L, Lu, Luc…).
  const textoBuscado = normalizar(busqueda);
  const hijosVisibles = useMemo(
    () => (textoBuscado ? hijos.filter((h) => normalizar(h.name).startsWith(textoBuscado)) : hijos),
    [hijos, textoBuscado]
  );

  // Accesibilidad: un lector de pantalla dice cuántos resultados hay (con una pequeña
  // espera para no hablar encima mientras se escribe).
  useEffect(() => {
    if (!textoBuscado) return;
    const espera = setTimeout(() => {
      const n = hijosVisibles.length;
      AccessibilityInfo.announceForAccessibility(
        n === 0 ? 'No hay hijos con ese nombre' : n === 1 ? '1 hijo encontrado' : `${n} hijos encontrados`
      );
    }, 700);
    return () => clearTimeout(espera);
  }, [textoBuscado, hijosVisibles.length]);

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
      mostrarAviso('Falta el nombre', 'Escribí un nombre antes de guardar.', { icono: 'create-outline' });
      return;
    }
    setGuardando(true);
    const { error } = hijoEditando
      ? await editarHijo(hijoEditando.id, nombreNuevo.trim())
      : await agregarHijo(nombreNuevo.trim());
    setGuardando(false);
    if (error) {
      if (hijoEditando && (error as any)?.response?.status === 404) {
        // El perfil ya no existe (se borró desde otro teléfono): reintentar no sirve.
        cerrarFormulario();
        cargarHijos();
        mostrarAviso('Ese perfil ya no existe', 'Se borró desde otro lugar. Actualizamos la lista.', {
          icono: 'search-outline',
        });
        return;
      }
      mostrarError(error, {
        que: hijoEditando ? 'guardar el nombre' : 'registrar al hijo',
        onReintentar: handleGuardar,
      });
      return;
    }
    cerrarFormulario();
  };

  // Mantener presionado un hijo abre el formulario de edición (igual que en
  // Docs y Calendario): ahí se cambia el nombre o se elimina.
  const abrirEdicion = (hijo: Hijo) => {
    setHijoEditando(hijo);
    setNombreNuevo(hijo.name);
    setMostrarFormulario(true);
  };

  const eliminar = async (hijo: Hijo) => {
    setEliminando(true);
    const { error } = await eliminarHijo(hijo.id);
    setEliminando(false);
    if (error) {
      if ((error as any)?.response?.status === 404) {
        // Ya no existía: se actualiza la lista y listo.
        cerrarFormulario();
        cargarHijos();
        return;
      }
      mostrarError(error, { que: 'eliminar el perfil', onReintentar: () => eliminar(hijo) });
      return;
    }
    cerrarFormulario();
  };

  const confirmarEliminar = async (hijo: Hijo) => {
    const seguro = await confirmar({
      titulo: `Eliminar a ${hijo.name}`,
      mensaje: 'Esto borra también sus documentos y sus turnos guardados. Esta acción no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (seguro) await eliminar(hijo);
  };

  if (cargando && hijos.length === 0) {
    return (
      <View style={styles.centro}>
        <EsperaServidor texto="Cargando tus hijos…" />
      </View>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={tema.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { justifyContent: 'center' }]}
      >
        <TarjetaError error={error} onReintentar={cargarHijos} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient 
      colors={tema.backgroundGradient} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 1 }} 
      style={styles.container}
    >

      {!mostrarFormulario && (
        <TouchableOpacity
          style={[styles.botonAgendarGrande, { backgroundColor: tema.primary }]}
          onPress={() => setMostrarFormulario(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.botonAgendarGrandeTexto}>👶  Registrar hijo</Text>
        </TouchableOpacity>
      )}

      {/* Buscador: mismo estilo que los títulos de carpeta de Docs. */}
      {hijos.length > 0 && !mostrarFormulario && (
        <View
          style={[
            styles.buscador,
            { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, 0.22) },
          ]}
        >
          <Ionicons name="search-outline" size={22} color="#1F1F1F" />
          <TextInput
            style={styles.buscadorInput}
            placeholder="Buscar hijo/a"
            placeholderTextColor="#5F5F5F"
            value={busqueda}
            onChangeText={setBusqueda}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar hijo por nombre"
            accessibilityHint="Escribí las primeras letras del nombre"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusqueda('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Borrar búsqueda"
            >
              <Ionicons name="close-circle" size={22} color="#3F3F3F" />
            </TouchableOpacity>
          )}
        </View>
      )}
      {textoBuscado.length > 0 && hijosVisibles.length > 0 && (
        <Text style={styles.resultados}>
          {hijosVisibles.length} de {hijos.length} {hijos.length === 1 ? 'hijo' : 'hijos'}
        </Text>
      )}

      {hijos.length === 0 ? (
        !mostrarFormulario && (
          <EstadoVacio
            icono="people-outline"
            titulo="Todavía no agregaste a ningún hijo"
            mensaje="Tocá Registrar hijo para crear su perfil. Después podés guardar sus documentos y turnos, y agregar a todos los hijos que quieras."
          />
        )
      ) : (
        <FlatList
          data={hijosVisibles}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EstadoVacio
              variante="compacta"
              icono="search-outline"
              titulo="No encontramos a ningún hijo con ese nombre"
              mensaje="Revisá cómo lo escribiste: se busca por las primeras letras."
              etiquetaAccion="Borrar búsqueda"
              onAccion={() => setBusqueda('')}
            />
          }
          renderItem={({ item }) => {
            const seleccionado = item.id === seleccionadoId;
            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  seleccionado && { backgroundColor: tema.bar, borderWidth: 1.5, borderColor: tema.primary },
                ]}
                onPress={() => seleccionarHijo(item.id)}
                onLongPress={() => abrirEdicion(item)}
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
        <FormularioSuperior onCerrar={hijoEditando && !guardando && !eliminando ? cerrarFormulario : undefined}>
          <Text style={styles.formularioTitulo}>
            {hijoEditando ? 'Editar hijo' : 'Nuevo hijo'}
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
              disabled={guardando || eliminando}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar, { backgroundColor: tema.primary }]}
              onPress={handleGuardar}
              disabled={guardando || eliminando}
            >
              <Text style={styles.botonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
          {hijoEditando && (
            <TouchableOpacity
              style={styles.botonEliminar}
              onPress={() => confirmarEliminar(hijoEditando)}
              disabled={guardando || eliminando}
            >
              <Text style={styles.botonEliminarTexto}>{eliminando ? 'Eliminando...' : 'Eliminar hijo'}</Text>
            </TouchableOpacity>
          )}
        </FormularioSuperior>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  textoGuiaSuave: { fontSize: 16, color: '#3F3F3F', marginTop: 0, marginBottom: 14 },
  ayuda: { fontSize: 14, color: '#3F3F3F', marginBottom: 8 },
  // Igual que EncabezadoCarpeta de Docs: bajo, con borde y tinte del color del tema.
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  buscadorInput: { flex: 1, fontSize: 16, color: '#1F1F1F', paddingVertical: 8 },
  resultados: { fontSize: 14, color: '#3F3F3F', marginBottom: 8 },
  botonAgendarGrande: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
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
  botonEliminar: { marginTop: 14, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#c62828' },
  botonEliminarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 16 },
});