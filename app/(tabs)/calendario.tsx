import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useChildren } from '../../context/ChildrenContext';
import { useTheme } from '../../context/ThemeContext';
import { useAvisos } from '../../context/AvisosContext';
import { TarjetaError } from '../../components/AvisoError';
import EsperaServidor from '../../components/EsperaServidor';
import EstadoVacio from '../../components/EstadoVacio';
import SelectorHijo from '../../components/SelectorHijo';
import { ErrorAmigable, interpretarError } from '../../lib/errores';
import FormularioSuperior from '../../components/FormularioSuperior';
import SelectorFechaHora from '../../components/SelectorFechaHora';
import SelectorLugar from '../../components/SelectorLugar';
import VentanaMapa from '../../components/VentanaMapa';
import {
  camposParaBackend,
  CamposLugarTurno,
  LUGAR_VACIO,
  Lugar,
  lugarDeTurno,
  tieneLugar,
  tituloDeLugar,
} from '../../lib/lugares';
import { normalizar } from '../../lib/busqueda';
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

type Turno = CamposLugarTurno & {
  id: number;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time: string | null; // 'HH:MM:SS' (así la devuelve Postgres)
  notes: string | null;
};

// Fila "especial" de la lista: va entre los turnos próximos y los pasados y lleva
// los botones para ver/ocultar y borrar los pasados. Su id (-1) nunca choca con
// el de un turno real.
type Separador = { id: -1; separador: true };
type Fila = Turno | Separador;
const SEPARADOR: Separador = { id: -1, separador: true };
const esSeparador = (fila: Fila): fila is Separador => 'separador' in fila;

// Orden cronológico: fecha y después hora (sin hora = primero del día).
function compararTurnos(a: Turno, b: Turno): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.time || '').localeCompare(b.time || '');
}

function horaCorta(hora: string | null): string {
  if (!hora) return '';
  return hora.slice(0, 5); // 'HH:MM:SS' -> 'HH:MM'
}

// Alto estimado de una tarjeta (con su margen) hasta que se mide de verdad.
const ALTURA_ESTIMADA = 82;

export default function Calendario() {
  const { hijos, seleccionadoId, cargando: cargandoHijos, error: errorHijos, cargarHijos } = useChildren();
  const { tema } = useTheme();
  const { mostrarError, mostrarAviso, confirmar } = useAvisos();
  const router = useRouter();
  const hijoSeleccionado = hijos.find((h) => h.id === seleccionadoId);

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false); // pull-to-refresh
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  // Buscador de turnos: lo escrito. Con algo escrito, la lista muestra solo lo que coincide.
  const [busqueda, setBusqueda] = useState('');
  // Mes que se está viendo en el calendario. Así, si la ventana cambia de tamaño y el calendario se
  // redibuja, no vuelve solo al mes de hoy.
  const [mesVisible, setMesVisible] = useState(fechaDeHoy());
  // Al cambiar de hijo se vacía el buscador: los turnos son otros.
  useEffect(() => setBusqueda(''), [seleccionadoId]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [fechaNueva, setFechaNueva] = useState(fechaDeHoy());
  const [horaNueva, setHoraNueva] = useState('');
  const [notasNuevas, setNotasNuevas] = useState('');
  // Lugar del turno (v2.7) y turno cuyo mapa se está mirando.
  const [lugarNuevo, setLugarNuevo] = useState<Lugar>(LUGAR_VACIO);
  const [turnoConMapa, setTurnoConMapa] = useState<Turno | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // null = formulario de turno NUEVO; con un turno = formulario de EDICIÓN.
  const [turnoEditando, setTurnoEditando] = useState<Turno | null>(null);
  // Los turnos de días anteriores a hoy empiezan ocultos; este botón los muestra.
  const [mostrarPasados, setMostrarPasados] = useState(false);
  // Mientras se borran los turnos viejos: cuántos van de cuántos (null = no se está borrando).
  const [progresoBorrado, setProgresoBorrado] = useState<{ hechos: number; total: number } | null>(null);

  // Efecto "carrusel": las tarjetas se desvanecen al acercarse a los bordes de la lista.
  // Pantalla ancha (PC / portátil): calendario a la izquierda y turnos a la derecha.
  // En pantallas angostas (celular o ventana chica) queda la columna de siempre.
  const { width: anchoPantalla } = useWindowDimensions();
  const esAncho = anchoPantalla >= ANCHO_MINIMO_DOS_COLUMNAS;
  // Altura real de la columna del calendario (para repartir los renglones y que llegue hasta el botón +).
  const [alturaCalendario, setAlturaCalendario] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const [alturaLista, setAlturaLista] = useState(0);
  const [alturas, setAlturas] = useState<Record<number, number>>({});
  // Alto del aviso "No tenés turnos próximos", que va arriba de la lista y la empuja hacia abajo.
  // El efecto carrusel lo necesita para saber dónde está de verdad cada tarjeta.
  const [alturaCabecera, setAlturaCabecera] = useState(0);

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
    } catch (e) {
      if (esRefresco) {
        // Se conservan los turnos que ya estaban; solo se avisa que no se pudo actualizar.
        mostrarError(e, { que: 'actualizar los turnos', onReintentar: () => cargarTurnos(true) });
      } else {
        setError(interpretarError(e, 'cargar los turnos'));
      }
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [seleccionadoId, mostrarError]);

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

  // Dos grupos:
  //  - próximos: los de HOY (aunque su hora ya haya pasado, por si se olvidó) y los futuros,
  //    del más cercano al más lejano;
  //  - pasados: los de días anteriores a hoy, del más reciente al más viejo
  //    (así la última cita queda arriba).
  const { proximos, pasados } = useMemo(() => {
    const hoy = fechaDeHoy();
    return {
      proximos: turnos.filter((t) => t.date >= hoy).sort(compararTurnos),
      pasados: turnos.filter((t) => t.date < hoy).sort((a, b) => compararTurnos(b, a)),
    };
  }, [turnos]);

  // Buscador. No distingue mayúsculas ni tildes. Cada palabra escrita debe estar en el título
  // o en las notas del turno ("pediatra control" = el control del pediatra).
  const palabrasBusqueda = useMemo(() => normalizar(busqueda).split(/\s+/).filter(Boolean), [busqueda]);
  const buscando = palabrasBusqueda.length > 0;
  const coincide = useCallback(
    (t: Turno) => {
      const texto = normalizar(`${t.title} ${t.notes ?? ''} ${t.location_name ?? ''} ${t.address ?? ''}`);
      return palabrasBusqueda.every((p) => texto.includes(p));
    },
    [palabrasBusqueda]
  );

  // Lista que se dibuja:
  //  - buscando: SIEMPRE primero los turnos que vienen (del más cercano al más lejano) y debajo
  //    los pasados (del más reciente al más viejo), sin necesidad de abrir "Ver turnos pasados";
  //  - si hay un día tocado, solo los turnos de ese día (también si es un día pasado);
  //  - si no: próximos, luego la fila de botones y, si se pidió, los pasados.
  const filas: Fila[] = useMemo(() => {
    if (buscando) return [...proximos.filter(coincide), ...pasados.filter(coincide)];
    if (diaSeleccionado) return turnos.filter((t) => t.date === diaSeleccionado).sort(compararTurnos);
    const lista: Fila[] = [...proximos];
    if (pasados.length > 0) {
      lista.push(SEPARADOR);
      if (mostrarPasados) lista.push(...pasados);
    }
    return lista;
  }, [turnos, buscando, coincide, diaSeleccionado, proximos, pasados, mostrarPasados]);

  // Formulario de turno NUEVO. Sin fecha: usa el día filtrado o, si no hay, hoy.
  const abrirFormulario = (fecha?: string) => {
    setTurnoEditando(null);
    setTituloNuevo('');
    setHoraNueva('');
    setNotasNuevas('');
    // Si se agenda en un día distinto al filtrado, se quita el filtro para que el
    // turno nuevo se vea en la lista al guardarlo.
    if (fecha && fecha !== diaSeleccionado) setDiaSeleccionado(null);
    setFechaNueva(fecha || diaSeleccionado || fechaDeHoy());
    setMostrarFormulario(true);
  };

  // Tocar un día:
  //  - si ya estaba filtrado, se quita el filtro;
  //  - si tiene turnos, se muestran solo los de ese día;
  //  - si NO tiene turnos, se abre directo el formulario para agendar uno ese día.
  const alTocarDia = (fecha: string) => {
    if (fecha === diaSeleccionado) {
      setDiaSeleccionado(null);
      return;
    }
    if (turnos.some((t) => t.date === fecha)) {
      setDiaSeleccionado(fecha);
    } else {
      abrirFormulario(fecha);
    }
  };

  // Abre el mismo formulario, cargado con los datos del turno tocado.
  const abrirEdicion = (turno: Turno) => {
    setTurnoEditando(turno);
    setTituloNuevo(turno.title);
    setFechaNueva(turno.date);
    setHoraNueva(turno.time ? horaCorta(turno.time) : '');
    setNotasNuevas(turno.notes ?? '');
    setLugarNuevo(lugarDeTurno(turno));
    setMostrarFormulario(true);
  };

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setTurnoEditando(null);
    setTituloNuevo('');
    setHoraNueva('');
    setNotasNuevas('');
    setLugarNuevo(LUGAR_VACIO);
  };

  const crearTurno = async () => {
    if (!seleccionadoId) return;
    if (!tituloNuevo.trim()) {
      mostrarAviso('Falta el título', 'Escribí para qué es el turno (ej. "Pediatra").', { icono: 'create-outline' });
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
          ...camposParaBackend(lugarNuevo, true), // null en los cuatro = quitar el lugar
        });
      } else {
        await api.post('/appointments', {
          child_id: seleccionadoId,
          title: tituloNuevo.trim(),
          date: fechaNueva,
          time: horaNueva || undefined, // sin hora = evento de todo el día
          notes: notasNuevas.trim() || undefined,
          ...camposParaBackend(lugarNuevo, false),
        });
      }
      cerrarFormulario();
      cargarTurnos();
    } catch (e: any) {
      if (turnoEditando && e?.response?.status === 404) {
        // El turno ya no existe (se borró desde otro teléfono): reintentar no sirve de nada.
        cerrarFormulario();
        cargarTurnos();
        mostrarAviso('Ese turno ya no existe', 'Se borró desde otro lugar. Actualizamos la lista.', {
          icono: 'search-outline',
        });
        return;
      }
      mostrarError(e, {
        que: turnoEditando ? 'guardar los cambios' : 'guardar el turno',
        onReintentar: crearTurno,
      });
    } finally {
      setGuardando(false);
    }
  };

  // Borra el turno (el backend borra primero el evento de Google Calendar y
  // después la fila). Se separa de la confirmación para poder reintentar.
  const eliminarTurno = async (turno: Turno) => {
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
      mostrarError(e, { que: 'borrar el turno', onReintentar: () => eliminarTurno(turno) });
    } finally {
      setEliminando(false);
    }
  };

  // Eliminar: pide confirmación con la ventana propia.
  const confirmarEliminar = async () => {
    if (!turnoEditando) return;
    const turno = turnoEditando;
    const seguro = await confirmar({
      titulo: 'Borrar turno',
      mensaje: `¿Borrar "${turno.title}" del ${fechaCorta(turno.date)}? También se borra de Google Calendar.`,
      textoConfirmar: 'Borrar',
      peligro: true,
    });
    if (seguro) await eliminarTurno(turno);
  };

  // Borra los turnos pasados de a uno (el backend solo sabe borrar de a uno y cada borrado
  // también quita el evento de Google Calendar). Si uno falla, se corta ahí y se ofrece
  // reintentar solo con los que faltan: nunca se dice "listo" si no se borró todo.
  const borrarListaDeViejos = async (lista: Turno[], total: number) => {
    setProgresoBorrado({ hechos: total - lista.length, total });
    let corte = -1;
    let ultimoError: unknown = null;
    for (let i = 0; i < lista.length; i++) {
      setProgresoBorrado({ hechos: total - lista.length + i, total });
      try {
        await api.delete(`/appointments/${lista[i].id}`);
      } catch (e: any) {
        if (e?.response?.status === 404) continue; // ya no existía: cuenta como borrado
        corte = i;
        ultimoError = e;
        break;
      }
    }
    setProgresoBorrado(null);
    await cargarTurnos(true);
    if (corte >= 0) {
      const pendientes = lista.slice(corte);
      mostrarError(ultimoError, {
        que: pendientes.length === 1 ? 'borrar el último turno viejo' : `borrar los ${pendientes.length} turnos viejos que faltan`,
        onReintentar: () => borrarListaDeViejos(pendientes, total),
      });
      return;
    }
    setMostrarPasados(false);
    mostrarAviso('Listo', total === 1 ? 'Se borró 1 turno viejo.' : `Se borraron ${total} turnos viejos.`, {
      icono: 'trash-outline',
    });
  };

  const confirmarBorrarViejos = async () => {
    if (pasados.length === 0 || progresoBorrado) return;
    const lista = [...pasados];
    const cuantos = lista.length === 1 ? 'el turno pasado' : `los ${lista.length} turnos pasados`;
    const seguro = await confirmar({
      titulo: 'Borrar turnos viejos',
      mensaje: `¿Querés borrar ${cuantos}? También se borran de Google Calendar y no se puede deshacer. Los de hoy y los próximos no se tocan.`,
      textoConfirmar: 'Borrar',
      peligro: true,
    });
    if (seguro) await borrarListaDeViejos(lista, lista.length);
  };

  if (cargandoHijos && hijos.length === 0) {
    return (
      <View style={styles.centro}>
        <EsperaServidor texto="Cargando tus hijos…" />
      </View>
    );
  }

  // Si la carga de hijos falló, no es que "falte agregar uno": hay que decirlo y dejar reintentar.
  if (errorHijos && hijos.length === 0) {
    return (
      <LinearGradient
        colors={tema.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { justifyContent: 'center' }]}
      >
        <TarjetaError error={errorHijos} onReintentar={cargarHijos} />
      </LinearGradient>
    );
  }

  // La carga funcionó y no hay ningún hijo: invitamos a agregar el primero.
  if (!seleccionadoId) {
    return (
      <LinearGradient
        colors={tema.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { justifyContent: 'center' }]}
      >
        <EstadoVacio
          icono="people-outline"
          titulo="Todavía no cargaste ningún hijo"
          mensaje="Para agendar turnos primero hay que cargar a tu hijo. Tocá el botón de abajo para agregar el primero."
          etiquetaAccion="Agregar mi primer hijo"
          onAccion={() => router.navigate('/hijos')}
        />
      </LinearGradient>
    );
  }

  // Medidas del calendario en pantalla ancha: más grande y ajustado al alto disponible.
  // Proporción: el calendario ocupa ~42 % del ancho (turnos, el resto), con un mínimo de 440 y un
  // máximo de 580 píxeles para que ni en una portátil chica quede apretado ni en un monitor enorme se estire.
  const anchoColCalendario = Math.max(440, Math.min(580, Math.round(anchoPantalla * 0.42)));
  // OJO: react-native-calendars calcula sus estilos UNA sola vez al crearse y después ignora cambios
  // del tema. Por eso el <Calendar> lleva una `key` con estas medidas: si cambian (ventana más baja,
  // zoom del navegador), se vuelve a crear con las medidas nuevas.
  const disponible = alturaCalendario || 520;
  const compacto = disponible < 400; // pantalla baja: se aprieta también el encabezado del calendario
  const GASTO_FIJO = compacto ? 80 : 105; // encabezado (mes + días de la semana) y márgenes, aprox.
  // Alto que le toca a cada uno de los 6 renglones; la casilla se achica sola si falta espacio.
  const altoRenglon = (disponible - GASTO_FIJO) / 6;
  const TAM_DIA = Math.max(24, Math.min(44, Math.floor(altoRenglon - 6))); // lado de cada casilla de día
  const margenRenglon = Math.max(1, Math.min(28, Math.floor((altoRenglon - TAM_DIA) / 2)));
  const fuenteDia = TAM_DIA < 30 ? 15 : TAM_DIA < 40 ? 17 : 20;
  const Envoltorio: any = esAncho ? ScrollView : View;
  const temaBase = {
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
  };
  const temaCalendario: any = esAncho
    ? {
        ...temaBase,
        textDayFontSize: fuenteDia,
        textMonthFontSize: compacto ? 20 : 23,
        textDayHeaderFontSize: compacto ? 14 : 16,
        weekVerticalMargin: margenRenglon,
        'stylesheet.day.basic': {
          base: { width: TAM_DIA, height: TAM_DIA, alignItems: 'center' },
          today: { backgroundColor: tema.bar, borderRadius: TAM_DIA / 2 },
          selected: { backgroundColor: tema.primary, borderRadius: TAM_DIA / 2 },
          text: { marginTop: Math.round(TAM_DIA / 4), fontSize: fuenteDia, color: '#1F1F1F', backgroundColor: 'rgba(0, 0, 0, 0)' },
        },
        // Encabezado: más ancho para que se lea "Dom" completo y, en pantalla baja, más apretado.
        'stylesheet.calendar.header': {
          header: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 10, marginTop: compacto ? 2 : 6, alignItems: 'center' },
          monthText: { fontSize: compacto ? 20 : 23, color: '#1F1F1F', margin: compacto ? 2 : 10 },
          week: { marginTop: compacto ? 2 : 7, flexDirection: 'row', justifyContent: 'space-around' },
          dayHeader: { marginTop: 2, marginBottom: compacto ? 2 : 7, width: TAM_DIA + 6, textAlign: 'center', fontSize: compacto ? 14 : 16, color: '#3F3F3F' },
        },
      }
    : temaBase;

  // Buscador (mismo estilo que el de Docs). En pantalla ancha va en la fila de arriba, a la altura
  // de "Estás viendo a" y empezando donde empiezan los turnos; en celular, arriba del texto de ayuda.
  const cajaBuscador = (
  <View
    style={[
      styles.buscador,
      esAncho ? styles.buscadorAncho : styles.buscadorMovil,
      { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, 0.22) },
    ]}
  >
    <Ionicons name="search-outline" size={18} color="#1F1F1F" />
    <TextInput
      style={[styles.buscadorInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
      placeholder="Buscar turno"
      placeholderTextColor="#5F5F5F"
      value={busqueda}
      onChangeText={(texto) => {
        setBusqueda(texto);
        if (texto.trim()) setDiaSeleccionado(null); // buscar es en todos los días
      }}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      accessibilityLabel="Buscar turno"
      accessibilityHint="Escribí el nombre del turno. Ejemplo: pediatra"
    />
    {busqueda.length > 0 && (
      <TouchableOpacity
        onPress={() => setBusqueda('')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Borrar búsqueda"
      >
        <Ionicons name="close-circle" size={20} color="#3F3F3F" />
      </TouchableOpacity>
    )}
  </View>
  );

  // Aviso de "sin turnos próximos" arriba de la lista (solo cuando hay turnos pasados guardados).
  const hayCabecera = !cargando && !error && !buscando && !diaSeleccionado && proximos.length === 0 && pasados.length > 0;

  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      {esAncho ? (
        <View style={styles.filaSuperior}>
          <View style={{ width: anchoColCalendario }}>
            <SelectorHijo />
          </View>
          {cajaBuscador}
        </View>
      ) : (
        <SelectorHijo />
      )}

      <View style={esAncho ? styles.cuerpoAncho : styles.cuerpo}>
      {/* El calendario queda FIJO: solo se desliza la lista de turnos. */}
      {/* En pantalla ancha, si la ventana es TAN baja que ni apretando cabe, el calendario se
          desliza dentro de su columna en vez de quedar cortado. */}
      <Envoltorio
        style={esAncho ? [styles.colCalendario, { width: anchoColCalendario }] : null}
        onLayout={esAncho ? (e: any) => setAlturaCalendario(e.nativeEvent.layout.height) : undefined}
        {...(esAncho ? { showsVerticalScrollIndicator: false } : {})}
      >
      <Calendar
        key={`${TAM_DIA}-${margenRenglon}-${compacto}-${esAncho}`}
        showSixWeeks={esAncho}
        current={mesVisible}
        onMonthChange={(m) => setMesVisible(m.dateString)}
        markedDates={diasMarcados}
        onDayPress={(dia) => alTocarDia(dia.dateString)}
        onDayLongPress={(dia) => abrirFormulario(dia.dateString)}
        theme={temaCalendario}
      />
      </Envoltorio>

      <View style={esAncho ? styles.colTurnos : styles.colTurnosMovil}>
      {/* En celular el buscador va aquí, arriba del texto de ayuda. */}
      {!esAncho && cajaBuscador}

      {diaSeleccionado && (
        <TouchableOpacity onPress={() => setDiaSeleccionado(null)} style={styles.verTodos}>
          <Text style={styles.verTodosTexto}>Mostrando solo el {fechaCorta(diaSeleccionado)} · Ver todos</Text>
        </TouchableOpacity>
      )}

      <View style={{ flex: 1 }} onLayout={(e) => setAlturaLista(e.nativeEvent.layout.height)}>
        <Animated.FlatList
          data={cargando || error ? [] : filas}
          keyExtractor={(item: Fila) => String(item.id)}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargarTurnos(true)}
              colors={[tema.primary]}
              tintColor={tema.primary}
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          ListHeaderComponent={
            hayCabecera ? (
              <View onLayout={(e) => setAlturaCabecera(Math.round(e.nativeEvent.layout.height))}>
                <EstadoVacio
                  variante="compacta"
                  icono="calendar-outline"
                  titulo="No tenés turnos próximos"
                  mensaje="Los turnos anteriores a hoy están guardados abajo."
                  etiquetaAccion="Agendar turno"
                  onAccion={() => abrirFormulario()}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            cargando ? (
              <View style={styles.centroFlex}>
                <EsperaServidor texto="Cargando turnos…" />
              </View>
            ) : error ? (
              <View style={styles.zonaError}>
                <TarjetaError error={error} onReintentar={() => cargarTurnos()} />
              </View>
            ) : buscando ? (
              <EstadoVacio
                variante="compacta"
                icono="search-outline"
                titulo="No encontramos ese turno"
                mensaje={`Nada coincide con "${busqueda.trim()}" en los turnos de ${hijoSeleccionado?.name}. Puede que esté en otro hijo: cambialo arriba, en "Estás viendo a".`}
                etiquetaAccion="Borrar búsqueda"
                onAccion={() => setBusqueda('')}
              />
            ) : (
              diaSeleccionado ? (
                <EstadoVacio
                  variante="compacta"
                  icono="calendar-clear-outline"
                  titulo="No hay turnos ese día"
                  mensaje=""
                  etiquetaAccion="Ver todos los turnos"
                  onAccion={() => setDiaSeleccionado(null)}
                />
              ) : (
                <EstadoVacio
                  icono="calendar-outline"
                  titulo={`${hijoSeleccionado?.name} todavía no tiene turnos`}
                  mensaje="Agendá controles médicos, vacunas u otras citas. También se guardan en tu Google Calendar."
                  etiquetaAccion="Agendar turno"
                  onAccion={() => abrirFormulario()}
                />
              )
            )
          }
          renderItem={({ item, index }: { item: Fila; index: number }) => {

            // Posición de la tarjeta dentro de la lista (suma de las alturas de las anteriores).
            const viewport = alturaLista || 400;
            const h = Math.min(alturas[item.id] ?? ALTURA_ESTIMADA, viewport);
            // Se parte del alto del aviso de arriba (si está): si no, las tarjetas se desvanecían
            // antes de tiempo al deslizar y parecían desaparecer.
            let y = hayCabecera ? alturaCabecera : 0;
            for (let j = 0; j < index; j++) y += alturas[filas[j].id] ?? ALTURA_ESTIMADA;
            const zona = h * 0.8; // tramo en el que se va volviendo transparente
            // scrollY -> [invisible abajo, visible, visible, invisible arriba]
            const entrada = [y + h - viewport - zona, y + h - viewport, y, y + zona];
            const opacity = scrollY.interpolate({
              inputRange: entrada,
              outputRange: [0, 1, 1, 0],
              extrapolate: 'clamp',
            });
            const scale = scrollY.interpolate({
              inputRange: entrada,
              outputRange: [0.92, 1, 1, 0.92],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                style={{ opacity, transform: [{ scale }] }}
                onLayout={(e) => {
                  const alto = Math.round(e.nativeEvent.layout.height);
                  setAlturas((prev) => (prev[item.id] === alto ? prev : { ...prev, [item.id]: alto }));
                }}
              >
                {esSeparador(item) ? (
                  <View style={styles.zonaPasados}>
                    {/* Mismo tamaño y forma que los títulos de carpeta de Docs. */}
                    <TouchableOpacity
                      style={[
                        styles.botonPasados,
                        { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, 0.22) },
                      ]}
                      onPress={() => setMostrarPasados((v) => !v)}
                      disabled={progresoBorrado !== null}
                      activeOpacity={0.7}
                      accessibilityLabel={mostrarPasados ? 'Ocultar turnos pasados' : 'Ver turnos pasados'}
                    >
                      <Ionicons name="time-outline" size={22} color="#1F1F1F" />
                      <Text style={styles.botonPasadosTexto} numberOfLines={1}>
                        {mostrarPasados ? 'Ocultar turnos pasados' : 'Ver turnos pasados'}
                      </Text>
                      <View style={[styles.contadorPasados, { backgroundColor: tema.primary }]}>
                        <Text style={styles.contadorPasadosTexto}>{pasados.length}</Text>
                      </View>
                      <Ionicons name={mostrarPasados ? 'chevron-down' : 'chevron-forward'} size={20} color="#1F1F1F" />
                    </TouchableOpacity>
                    {mostrarPasados && (
                      <TouchableOpacity
                        style={[styles.botonPasados, styles.botonViejos]}
                        onPress={confirmarBorrarViejos}
                        disabled={progresoBorrado !== null}
                        activeOpacity={0.7}
                        accessibilityLabel="Borrar turnos viejos"
                      >
                        <Ionicons name="trash-outline" size={22} color="#c62828" />
                        <Text style={styles.botonViejosTexto} numberOfLines={1}>
                          {progresoBorrado
                            ? `Borrando ${Math.min(progresoBorrado.hechos + 1, progresoBorrado.total)} de ${progresoBorrado.total}…`
                            : 'Borrar turnos viejos'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                <TouchableOpacity
                  style={styles.card}
                  onLongPress={() => abrirEdicion(item)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Turno ${item.title}`}
                  accessibilityHint="Mantené presionado para editar o borrar"
                >
                  <View
                    style={[
                      styles.fechaBox,
                      {
                        backgroundColor: esTurnoPasado(item.date, item.time)
                          ? colorConOpacidad(tema.primary, 0.5)
                          : tema.primary,
                      },
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
                    {tieneLugar(lugarDeTurno(item)) && (
                      <TouchableOpacity
                        style={styles.lugarFila}
                        onPress={() => setTurnoConMapa(item)}
                        activeOpacity={0.6}
                        accessibilityLabel={`Ver en el mapa: ${tituloDeLugar(lugarDeTurno(item))}`}
                      >
                        <Ionicons name="location" size={16} color="#1F1F1F" />
                        <Text style={styles.lugarTexto} numberOfLines={1}>
                          {tituloDeLugar(lugarDeTurno(item))}
                        </Text>
                        <Text style={styles.lugarVer}>Ver mapa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
                )}
              </Animated.View>
            );
          }}
        />
      </View>
      </View>
      </View>

      {turnoConMapa && (
        <VentanaMapa lugar={lugarDeTurno(turnoConMapa)} onCerrar={() => setTurnoConMapa(null)} />
      )}

      {mostrarFormulario && (
        <FormularioSuperior
          key={turnoEditando ? `editar-${turnoEditando.id}` : 'nuevo'}
          onCerrar={guardando || eliminando ? undefined : cerrarFormulario}
        >
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
          <SelectorLugar lugar={lugarNuevo} onCambiar={setLugarNuevo} deshabilitado={guardando || eliminando} />
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder="Notas (opcional)"
            value={notasNuevas}
            onChangeText={setNotasNuevas}
            returnKeyType="done"
            onSubmitEditing={() => { if (!guardando && !eliminando) crearTurno(); }}
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
              accessibilityLabel="Borrar este turno"
            >
              <Text style={styles.botonEliminarTexto}>{eliminando ? 'Borrando...' : 'Borrar turno'}</Text>
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
        <TouchableOpacity style={[styles.fab, { backgroundColor: tema.primary }]} onPress={() => abrirFormulario()}>
          <Text style={styles.fabTexto}>+</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

// Desde este ancho (en píxeles) se muestran dos columnas.
const ANCHO_MINIMO_DOS_COLUMNAS = 900;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  // Celular / pantalla angosta: una sola columna (como siempre).
  cuerpo: { flex: 1 },
  colTurnosMovil: { flex: 1 },
  // PC / portátil: calendario | turnos, centrado y con un ancho máximo.
  cuerpoAncho: { flex: 1, flexDirection: 'row', gap: 20, marginTop: 8 },
  // Se estira hacia abajo hasta la línea de arriba del botón +
  // (el botón mide 56 y está a 30 del borde; el contenedor ya deja 16 de margen).
  // flexGrow/flexShrink en 0: el calendario respeta SU ancho (una proporción fija de la pantalla) y
  // no se come el espacio de los turnos. (El ScrollView de la web trae flexGrow: 1 por defecto.)
  colCalendario: { width: 440, flexGrow: 0, flexShrink: 0, alignSelf: 'stretch', marginBottom: 45, overflow: 'hidden', borderRadius: 8 },
  colTurnos: { flex: 1, minWidth: 0 },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 4,
    minWidth: 0,
    overflow: 'hidden',
  },
  // Pantalla ancha: fila de arriba = [selector de hijo (ancho del calendario)] [buscador].
  filaSuperior: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  buscadorAncho: { flex: 1, marginBottom: 0 },
  // Celular: el buscador va centrado entre el calendario y la primera tarjeta de turno.
  // Espacio de arriba = marginTop (+ el aire propio del calendario). Espacio de abajo = marginBottom + 10
  // (la tarjeta trae 10 de margen). Bajar el buscador 1 px: marginTop +1 y marginBottom -1 (la lista no se mueve).
  buscadorMovil: { marginTop: 5, marginBottom: -1 },
  buscadorInput: { flex: 1, minWidth: 0, fontSize: 15, color: '#1F1F1F', paddingVertical: 0 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centroFlex: { alignItems: 'center', marginTop: 40, gap: 12 },
  zonaError: { marginTop: 24 },
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
  lugarFila: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 2 },
  lugarTexto: { flexShrink: 1, fontSize: 14, color: '#1F1F1F', fontWeight: '600' },
  lugarVer: { fontSize: 14, color: '#0D47A1', textDecorationLine: 'underline', marginLeft: 4 },
  zonaPasados: { marginTop: 10, marginBottom: 2, gap: 8 },
  // Igual que EncabezadoCarpeta de Docs: bajo, con borde y tinte del color.
  botonPasados: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  botonPasadosTexto: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  contadorPasados: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  contadorPasadosTexto: { fontSize: 13, fontWeight: 'bold', color: '#1F1F1F' },
  // Rojo fijo, igual que los demás botones de eliminar.
  botonViejos: { borderColor: '#c62828', backgroundColor: '#c628281F' },
  botonViejosTexto: { flex: 1, fontSize: 16, fontWeight: '700', color: '#c62828' },
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