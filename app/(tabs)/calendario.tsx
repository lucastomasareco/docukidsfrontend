import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
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
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [fechaNueva, setFechaNueva] = useState(fechaDeHoy());
  const [horaNueva, setHoraNueva] = useState('');
  const [notasNuevas, setNotasNuevas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  // null = formulario de turno NUEVO; con un turno = formulario de EDICIÓN.
  const [turnoEditando, setTurnoEditando] = useState<Turno | null>(null);
  // Los turnos de días anteriores a hoy empiezan ocultos; este botón los muestra.
  const [mostrarPasados, setMostrarPasados] = useState(false);
  // Mientras se borran los turnos viejos: cuántos van de cuántos (null = no se está borrando).
  const [progresoBorrado, setProgresoBorrado] = useState<{ hechos: number; total: number } | null>(null);

  // Efecto "carrusel": las tarjetas se desvanecen al acercarse a los bordes de la lista.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [alturaLista, setAlturaLista] = useState(0);
  const [alturas, setAlturas] = useState<Record<number, number>>({});

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

  // Lista que se dibuja: si hay un día tocado, solo los turnos de ese día (también si es
  // un día pasado). Si no: próximos, luego la fila de botones y, si se pidió, los pasados.
  const filas: Fila[] = useMemo(() => {
    if (diaSeleccionado) return turnos.filter((t) => t.date === diaSeleccionado).sort(compararTurnos);
    const lista: Fila[] = [...proximos];
    if (pasados.length > 0) {
      lista.push(SEPARADOR);
      if (mostrarPasados) lista.push(...pasados);
    }
    return lista;
  }, [turnos, diaSeleccionado, proximos, pasados, mostrarPasados]);

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

  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <SelectorHijo />

      {/* El calendario queda FIJO: solo se desliza la lista de turnos de abajo. */}
      <Calendar
        current={fechaDeHoy()}
        markedDates={diasMarcados}
        onDayPress={(dia) => alTocarDia(dia.dateString)}
        onDayLongPress={(dia) => abrirFormulario(dia.dateString)}
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
      {!cargando && !error && (
        <Text style={styles.pista}>
          Tocá un día libre para agendar un turno (en un día con turnos: mantenelo presionado o usá el botón +). Mantené presionado un turno para editarlo o eliminarlo.
        </Text>
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
            !cargando && !error && !diaSeleccionado && proximos.length === 0 && pasados.length > 0 ? (
              <EstadoVacio
                variante="compacta"
                icono="calendar-outline"
                titulo="No tenés turnos próximos"
                mensaje="Los turnos anteriores a hoy están guardados abajo."
                etiquetaAccion="Agendar turno"
                onAccion={() => abrirFormulario()}
              />
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
            let y = 0;
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
                  </View>
                </TouchableOpacity>
                )}
              </Animated.View>
            );
          }}
        />
      </View>

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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  pista: { fontSize: 13, color: '#3F3F3F', textAlign: 'center', marginTop: 6 },
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