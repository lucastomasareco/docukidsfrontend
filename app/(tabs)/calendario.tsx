import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useChildren } from '../../context/ChildrenContext';
import { useTheme } from '../../context/ThemeContext';
import FormularioSuperior from '../../components/FormularioSuperior';
import SelectorFechaHora from '../../components/SelectorFechaHora';
import { colorConOpacidad, esTurnoPasado, fechaCorta, fechaDeHoy } from '../../lib/fechas';

// Nombres de meses/días en español para el calendario (react-native-calendars
// viene en inglés por defecto).
LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

type Turno = {
  id: number;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time: string | null; // 'HH:MM:SS' (así la devuelve Postgres)
  notes: string | null;
};

function horaCorta(hora: string | null): string {
  if (!hora) return '';
  return hora.slice(0, 5); // 'HH:MM:SS' -> 'HH:MM'
}

// El backend manda "detail" como texto, o como lista en errores 422.
function mensajeDeError(e: any): string {
  const detalle = e?.response?.data?.detail;
  if (typeof detalle === 'string') return detalle;
  return e?.message || 'Error desconocido';
}

export default function Calendario() {
  const { hijos, seleccionadoId, cargando: cargandoHijos } = useChildren();
  const { tema } = useTheme();
  const hijoSeleccionado = hijos.find((h) => h.id === seleccionadoId);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false); // pull-to-refresh
  const [error, setError] = useState<string | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [fechaNueva, setFechaNueva] = useState(fechaDeHoy());
  const [horaNueva, setHoraNueva] = useState('');
  const [notasNuevas, setNotasNuevas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // null = formulario de turno NUEVO; con un turno = formulario de EDICIÓN.
  const [turnoEditando, setTurnoEditando] = useState<Turno | null>(null);

  // esRefresco = true cuando viene del gesto de deslizar hacia abajo: en ese caso
  // la lista NO se reemplaza por el spinner grande (se ve el circulito de arriba)
  // y, si falla, se conservan los turnos que ya estaban en pantalla.
  const cargarTurnos = useCallback(async (esRefresco: boolean = false) => {
    if (!seleccionadoId) {
      setTurnos([]);
      setCargando(false);
      return;
    }
    if (esRefresco) {
      setRefrescando(true);
    } else {
      setCargando(true);
      setError(null);
    }
    try {
      const respuesta = await api.get(`/appointments/${seleccionadoId}`);
      setTurnos(respuesta.data.appointments);
      setError(null);
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      if (esRefresco) {
        Alert.alert('No se pudo actualizar', typeof detalle === 'string' ? detalle : 'Intentá de nuevo en un rato.');
      } else {
        setError(typeof detalle === 'string' ? detalle : 'Error desconocido');
      }
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [seleccionadoId]);

  useFocusEffect(
    useCallback(() => {
      cargarTurnos();
    }, [cargarTurnos])
  );

  // Puntos marcados en el calendario: un punto por cada día con al menos un turno.
  const diasMarcados = useMemo(() => {
    const marcas: Record<string, any> = {};
    // Punto a color completo si el día tiene algún turno próximo;
    // al 50 % si todos los turnos de ese día ya pasaron.
    turnos.forEach((t) => {
      const pasado = esTurnoPasado(t.date, t.time);
      const yaHabiaProximo = marcas[t.date]?.dotColor === tema.primary;
      marcas[t.date] = {
        marked: true,
        dotColor: !pasado || yaHabiaProximo ? tema.primary : colorConOpacidad(tema.primary, 0.5),
      };
    });
    if (diaSeleccionado) {
      marcas[diaSeleccionado] = {
        ...(marcas[diaSeleccionado] || {}),
        selected: true,
        selectedColor: tema.primary,
      };
    }
    return marcas;
  }, [turnos, diaSeleccionado, tema.primary]);

  // Lista a mostrar: si hay un día tocado, solo los turnos de ese día.
  // Si no, todos, ordenados por fecha y hora.
  const turnosAMostrar = useMemo(() => {
    const lista = diaSeleccionado ? turnos.filter((t) => t.date === diaSeleccionado) : [...turnos];
    return lista.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [turnos, diaSeleccionado]);

  const abrirFormulario = () => {
    setTurnoEditando(null);
    setTituloNuevo('');
    setHoraNueva('');
    setNotasNuevas('');
    setFechaNueva(diaSeleccionado || fechaDeHoy());
    setMostrarFormulario(true);
  };

  // Abre el mismo formulario, cargado con los datos del turno tocado.
  const abrirEdicion = (turno: Turno) => {
    setTurnoEditando(turno);
    setTituloNuevo(turno.title);
    setFechaNueva(turno.date);
    setHoraNueva(turno.time ? horaCorta(turno.time) : '');
    setNotasNuevas(turno.notes ?? '');
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setTurnoEditando(null);
    setTituloNuevo('');
    setHoraNueva('');
    setNotasNuevas('');
  };

  const crearTurno = async () => {
    if (!seleccionadoId) return;
    if (!tituloNuevo.trim()) {
      Alert.alert('Falta el título', 'Escribí para qué es el turno (ej. "Pediatra").');
      return;
    }
    setGuardando(true);
    try {
      if (turnoEditando) {
        // Edición: se mandan todos los campos; null quita la hora / las notas.
        await api.patch(`/appointments/${turnoEditando.id}`, {
          title: tituloNuevo.trim(),
          date: fechaNueva,
          time: horaNueva || null, // sin hora = evento de todo el día
          notes: notasNuevas.trim() || null,
        });
      } else {
        await api.post('/appointments', {
          child_id: seleccionadoId,
          title: tituloNuevo.trim(),
          date: fechaNueva,
          time: horaNueva || undefined, // sin hora = evento de todo el día
          notes: notasNuevas.trim() || undefined,
        });
      }
      cerrarFormulario();
      cargarTurnos();
    } catch (e: any) {
      Alert.alert(turnoEditando ? 'No se pudo guardar los cambios' : 'No se pudo guardar el turno', mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar: pide confirmación; el backend borra primero el evento de Google
  // Calendar y después el turno.
  const confirmarEliminar = () => {
    if (!turnoEditando) return;
    const turno = turnoEditando;
    Alert.alert(
      'Eliminar turno',
      `¿Eliminar "${turno.title}" del ${fechaCorta(turno.date)}? También se borra de Google Calendar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setEliminando(true);
            try {
              await api.delete(`/appointments/${turno.id}`);
              cerrarFormulario();
              cargarTurnos();
            } catch (e: any) {
              if (e?.response?.status === 404) {
                // Ya no existía (por ejemplo, se borró desde otro teléfono): se actualiza la lista.
                cerrarFormulario();
                cargarTurnos();
                return;
              }
              Alert.alert('No se pudo eliminar el turno', mensajeDeError(e));
            } finally {
              setEliminando(false);
            }
          },
        },
      ]
    );
  };

  if (cargandoHijos && hijos.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!seleccionadoId) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacio}>Primero agregá y seleccioná un hijo en la pestaña "Hijos".</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <Text style={styles.titulo}>Calendario</Text>
      <Text style={styles.subtitulo}>{hijoSeleccionado?.name}</Text>

      <Calendar
        current={fechaDeHoy()}
        markedDates={diasMarcados}
        onDayPress={(dia) => setDiaSeleccionado(dia.dateString === diaSeleccionado ? null : dia.dateString)}
        theme={{
          todayTextColor: '#1F1F1F',
          todayBackgroundColor: tema.bar,
          dayTextColor: '#1F1F1F',
          monthTextColor: '#1F1F1F',
          textSectionTitleColor: '#3F3F3F',
          textDisabledColor: '#8A8A8A',
          selectedDayBackgroundColor: tema.primary,
          selectedDayTextColor: '#1F1F1F',
          arrowColor: '#1F1F1F',
          textDayFontSize: 17,
          textMonthFontSize: 19,
          textDayHeaderFontSize: 15,
        }}
      />

      {diaSeleccionado && (
        <TouchableOpacity onPress={() => setDiaSeleccionado(null)} style={styles.verTodos}>
          <Text style={styles.verTodosTexto}>Mostrando solo el {fechaCorta(diaSeleccionado)} · Ver todos</Text>
        </TouchableOpacity>
      )}

      {cargando ? (
        <View style={styles.centroFlex}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={error ? [] : turnosAMostrar}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargarTurnos(true)}
              colors={[tema.primary]}
              tintColor={tema.primary}
            />
          }
          // Con la lista vacía (o con error) también se puede deslizar para actualizar.
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          ListEmptyComponent={
            error ? (
              <View style={styles.centroFlex}>
                <Text style={styles.textoError}>No se pudo cargar: {error}</Text>
                <TouchableOpacity
                  style={[styles.botonReintentar, { backgroundColor: tema.primary }]}
                  onPress={() => cargarTurnos()}
                >
                  <Text style={styles.botonTexto}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.vacio}>
                {diaSeleccionado ? 'No hay turnos ese día.' : `${hijoSeleccionado?.name} todavía no tiene turnos.`}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const pasado = esTurnoPasado(item.date, item.time);
            return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => abrirEdicion(item)}
              activeOpacity={0.7}
              accessibilityLabel={`Editar turno ${item.title}`}
            >
              <View
                style={[
                  styles.fechaBox,
                  { backgroundColor: pasado ? colorConOpacidad(tema.primary, 0.5) : tema.primary },
                ]}
              >
                <Text style={styles.fechaBoxTexto}>{item.date.slice(8, 10)}</Text>
                <Text style={styles.fechaBoxMes}>{item.date.slice(5, 7)}/{item.date.slice(0, 4)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.title}</Text>
                <Text style={styles.estado}>
                  {item.time ? horaCorta(item.time) : 'Todo el día'}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
            );
          }}
        />
      )}

      {mostrarFormulario && (
        <FormularioSuperior key={turnoEditando ? `editar-${turnoEditando.id}` : 'nuevo'}>
          <Text style={styles.tituloFormulario}>{turnoEditando ? 'Editar turno' : 'Nuevo turno'}</Text>
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder='Título (ej. "Pediatra")'
            value={tituloNuevo}
            onChangeText={setTituloNuevo}
            autoFocus={!turnoEditando}
          />
          <SelectorFechaHora
            fecha={fechaNueva}
            onCambiarFecha={setFechaNueva}
            hora={horaNueva}
            onCambiarHora={setHoraNueva}
          />
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder="Notas (opcional)"
            value={notasNuevas}
            onChangeText={setNotasNuevas}
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
              onPress={crearTurno}
              disabled={guardando || eliminando}
            >
              <Text style={styles.botonTexto}>
                {guardando ? 'Guardando...' : turnoEditando ? 'Guardar cambios' : 'Guardar turno'}
              </Text>
            </TouchableOpacity>
          </View>
          {turnoEditando && (
            <TouchableOpacity
              style={styles.botonEliminar}
              onPress={confirmarEliminar}
              disabled={guardando || eliminando}
              accessibilityLabel="Eliminar este turno"
            >
              <Text style={styles.botonEliminarTexto}>{eliminando ? 'Eliminando...' : 'Eliminar turno'}</Text>
            </TouchableOpacity>
          )}
          {guardando && (
            <Text style={styles.textoGuardando}>
              {turnoEditando ? 'Actualizando el evento en Google Calendar...' : 'Creando el evento en Google Calendar...'}
            </Text>
          )}
          {eliminando && <Text style={styles.textoGuardando}>Borrando el evento de Google Calendar...</Text>}
        </FormularioSuperior>
      )}

      {!mostrarFormulario && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: tema.primary }]} onPress={abrirFormulario}>
          <Text style={styles.fabTexto}>+</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centroFlex: { alignItems: 'center', marginTop: 40, gap: 12 },
  textoError: { fontSize: 16, textAlign: 'center', color: '#b71c1c' },
  botonReintentar: { backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  titulo: { fontSize: 26, fontWeight: 'bold' },
  subtitulo: { fontSize: 17, color: '#3F3F3F', marginBottom: 12 },
  vacio: { fontSize: 16, color: '#3F3F3F', marginTop: 20, textAlign: 'center' },
  verTodos: { paddingVertical: 10 },
  verTodosTexto: { color: '#0D47A1', fontSize: 15, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  fechaBox: {
    width: 64,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fechaBoxTexto: { color: '#1F1F1F', fontSize: 18, fontWeight: 'bold', lineHeight: 20 },
  fechaBoxMes: { color: '#1F1F1F', fontSize: 12, fontWeight: '600' },
  nombre: { fontSize: 18, fontWeight: '600' },
  estado: { fontSize: 15, color: '#3F3F3F' },
  botonTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
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
  fabTexto: { color: '#1F1F1F', fontSize: 28, lineHeight: 30 },
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16, color: '#1F1F1F' },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#D0D0D0' },
  botonGuardar: { backgroundColor: '#1976d2' },
  tituloFormulario: { fontSize: 18, fontWeight: 'bold', color: '#1F1F1F', marginBottom: 10 },
  // Rojo fijo (igual que "No vence"): para que se lea antes de tocarlo.
  botonEliminar: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#c62828',
    alignItems: 'center',
  },
  botonEliminarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 16 },
  textoGuardando: { fontSize: 14, color: '#3F3F3F', marginTop: 8, textAlign: 'center' },
});