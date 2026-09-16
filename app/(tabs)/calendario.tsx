import { useState, useCallback, useMemo } from 'react';
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
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useChildren } from '../../context/ChildrenContext';
import { useTheme } from '../../context/ThemeContext';

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

function fechaDeHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function horaCorta(hora: string | null): string {
  if (!hora) return '';
  return hora.slice(0, 5); // 'HH:MM:SS' -> 'HH:MM'
}

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export default function Calendario() {
  const { hijos, seleccionadoId, cargando: cargandoHijos } = useChildren();
  const { tema } = useTheme();
  const hijoSeleccionado = hijos.find((h) => h.id === seleccionadoId);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [fechaNueva, setFechaNueva] = useState(fechaDeHoy());
  const [horaNueva, setHoraNueva] = useState('');
  const [notasNuevas, setNotasNuevas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarTurnos = useCallback(async () => {
    if (!seleccionadoId) {
      setTurnos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.get(`/appointments/${seleccionadoId}`);
      setTurnos(respuesta.data.appointments);
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      setError(detalle);
    } finally {
      setCargando(false);
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
    turnos.forEach((t) => {
      marcas[t.date] = { marked: true, dotColor: tema.primary };
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
    setFechaNueva(diaSeleccionado || fechaDeHoy());
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
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
    if (!REGEX_FECHA.test(fechaNueva)) {
      Alert.alert('Fecha inválida', 'Escribila con el formato AAAA-MM-DD, ej: 2026-09-20.');
      return;
    }
    if (!REGEX_HORA.test(horaNueva)) {
      Alert.alert('Hora inválida', 'Escribila con el formato HH:MM (24hs), ej: 14:30.');
      return;
    }
    setGuardando(true);
    try {
      await api.post('/appointments', {
        child_id: seleccionadoId,
        title: tituloNuevo.trim(),
        date: fechaNueva,
        time: horaNueva,
        notes: notasNuevas.trim() || undefined,
      });
      cerrarFormulario();
      cargarTurnos();
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      Alert.alert('No se pudo guardar el turno', detalle);
    } finally {
      setGuardando(false);
    }
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
        theme={{ todayTextColor: tema.primary, selectedDayBackgroundColor: tema.primary, arrowColor: tema.primary }}
      />

      {diaSeleccionado && (
        <TouchableOpacity onPress={() => setDiaSeleccionado(null)} style={styles.verTodos}>
          <Text style={styles.verTodosTexto}>Mostrando solo el {diaSeleccionado} · Ver todos</Text>
        </TouchableOpacity>
      )}

      {cargando ? (
        <View style={styles.centroFlex}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centroFlex}>
          <Text style={styles.textoError}>No se pudo cargar: {error}</Text>
          <TouchableOpacity style={styles.botonReintentar} onPress={cargarTurnos}>
            <Text style={styles.botonTexto}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : turnosAMostrar.length === 0 ? (
        <Text style={styles.vacio}>
          {diaSeleccionado ? 'No hay turnos ese día.' : `${hijoSeleccionado?.name} todavía no tiene turnos.`}
        </Text>
      ) : (
        <FlatList
          data={turnosAMostrar}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.fechaBox, { backgroundColor: tema.primary }]}>
                <Text style={styles.fechaBoxTexto}>{item.date.slice(8, 10)}</Text>
                <Text style={styles.fechaBoxMes}>{item.date.slice(5, 7)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.title}</Text>
                <Text style={styles.estado}>
                  {horaCorta(item.time)}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {mostrarFormulario && (
        <View style={styles.formulario}>
          <TextInput
            style={styles.input}
            placeholder='Título (ej. "Pediatra")'
            value={tituloNuevo}
            onChangeText={setTituloNuevo}
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Fecha (AAAA-MM-DD)"
            value={fechaNueva}
            onChangeText={setFechaNueva}
          />
          <TextInput
            style={styles.input}
            placeholder="Hora (HH:MM, ej. 14:30)"
            value={horaNueva}
            onChangeText={setHoraNueva}
          />
          <TextInput
            style={styles.input}
            placeholder="Notas (opcional)"
            value={notasNuevas}
            onChangeText={setNotasNuevas}
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
              onPress={crearTurno}
              disabled={guardando}
            >
              <Text style={styles.botonTexto}>{guardando ? 'Guardando...' : 'Guardar turno'}</Text>
            </TouchableOpacity>
          </View>
          {guardando && (
            <Text style={styles.textoGuardando}>Creando el evento en Google Calendar...</Text>
          )}
        </View>
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
  textoError: { textAlign: 'center', color: '#c62828' },
  botonReintentar: { backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  subtitulo: { fontSize: 15, color: '#666', marginBottom: 12 },
  vacio: { color: '#666', marginTop: 20, textAlign: 'center' },
  verTodos: { paddingVertical: 10 },
  verTodosTexto: { color: '#1976d2', fontSize: 13, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  fechaBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fechaBoxTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold', lineHeight: 18 },
  fechaBoxMes: { color: '#dce8f7', fontSize: 10 },
  nombre: { fontSize: 16, fontWeight: '600' },
  estado: { fontSize: 13, color: '#666' },
  botonTexto: { color: '#fff', fontWeight: 'bold' },
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#999' },
  botonGuardar: { backgroundColor: '#1976d2' },
  textoGuardando: { fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' },
});