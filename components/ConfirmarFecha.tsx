import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, ScrollView, useWindowDimensions } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { TarjetaError } from './AvisoError';
import { ErrorAmigable, interpretarError } from '../lib/errores';

// El español del calendario se registra en calendario.tsx. Si por algún motivo
// este componente se mostrara antes de que esa pantalla se haya cargado,
// lo registramos acá también (es idempotente: pisa con los mismos valores).
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

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// 'YYYY-MM-DD' -> '15 de marzo de 2027'. Se arma a mano (sin new Date) para
// evitar que la zona horaria del teléfono corra la fecha un día.
function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

function hoyISO(): string {
  const h = new Date();
  const mes = String(h.getMonth() + 1).padStart(2, '0');
  const dia = String(h.getDate()).padStart(2, '0');
  return `${h.getFullYear()}-${mes}-${dia}`;
}

// Suma (o resta) años a 'YYYY-MM-DD' y lo deja en día 01 del mes.
function moverAnios(iso: string, delta: number): string {
  const [anio, mes] = iso.split('-').map(Number);
  return `${anio + delta}-${String(mes).padStart(2, '0')}-01`;
}

// Rojo fijo para "No vence": a propósito NO usa el color del tema, para que
// la persona se detenga a leer antes de tocarlo.
const ROJO_NO_VENCE = '#c62828';

// Ancho máximo de la ventana en PC (en el celular ocupa el ancho disponible, como siempre).
// Pregunta: chica, como la ventana de borrar un documento. Calendario: el ancho del formulario de subir.
const ANCHO_PREGUNTA = 400;
const ANCHO_CALENDARIO = 840;

type Props = {
  visible: boolean;
  docId: number;
  nombreDocumento: string;
  // Fecha que detectó el OCR ('YYYY-MM-DD') o null si no encontró ninguna.
  fechaDetectada: string | null;
  // true = abre directo el calendario (para cambiar la fecha de un documento ya subido, desde Editar).
  // "Volver" cierra sin cambios. Sin esta prop, funciona como siempre (pregunta "¿Es correcto?").
  empezarEligiendo?: boolean;
  // Se llama al terminar (con o sin cambios). El padre recarga la lista.
  onTerminar: () => void;
};

export default function ConfirmarFecha({ visible, docId, nombreDocumento, fechaDetectada, empezarEligiendo = false, onTerminar }: Props) {
  const { tema } = useTheme();
  const { height: alto } = useWindowDimensions();
  const [modo, setModo] = useState<'pregunta' | 'elegir'>(empezarEligiendo ? 'elegir' : 'pregunta');
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);
  const [mesVisible, setMesVisible] = useState<string>(fechaDetectada ?? hoyISO());
  // Se incrementa solo al saltar de año, para forzar al calendario a mostrar ese mes.
  const [claveCalendario, setClaveCalendario] = useState(0);
  const [guardando, setGuardando] = useState(false);
  // Error al guardar. Va DENTRO del modal (el aviso que baja desde arriba
  // quedaría tapado, porque el modal es una ventana aparte).
  const [errorGuardar, setErrorGuardar] = useState<ErrorAmigable | null>(null);
  const ultimoCuerpo = useRef<{ expiry_date: string } | { no_expiry: true } | null>(null);

  const cerrar = () => {
    setModo('pregunta');
    setFechaElegida(null);
    setErrorGuardar(null);
    onTerminar();
  };

  const enviar = async (cuerpo: { expiry_date: string } | { no_expiry: true }) => {
    ultimoCuerpo.current = cuerpo;
    setErrorGuardar(null);
    setGuardando(true);
    try {
      await api.patch(`/documents/${docId}`, cuerpo);
      cerrar();
    } catch (e) {
      setErrorGuardar(interpretarError(e, 'guardar la fecha'));
    } finally {
      setGuardando(false);
    }
  };

  const irAElegir = () => {
    setErrorGuardar(null);
    setFechaElegida(null);
    setMesVisible(fechaDetectada ?? hoyISO());
    setClaveCalendario((c) => c + 1);
    setModo('elegir');
  };

  const saltarAnio = (delta: number) => {
    setMesVisible((actual) => moverAnios(actual, delta));
    setClaveCalendario((c) => c + 1);
  };

  const botonTemaRelleno = { backgroundColor: tema.primary, borderColor: tema.primary };
  const botonTemaBorde = { backgroundColor: 'transparent', borderColor: tema.primary };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fondo}>
        <View
          style={[
            styles.caja,
            { backgroundColor: tema.card, maxWidth: modo === 'pregunta' ? ANCHO_PREGUNTA : ANCHO_CALENDARIO, maxHeight: alto * 0.92 },
          ]}
        >
          {/* Si la pantalla es muy baja, la ventana se desplaza en vez de cortarse. */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {modo === 'pregunta' ? (
            <>
              <Text style={styles.documento} numberOfLines={1}>{nombreDocumento}</Text>

              {fechaDetectada ? (
                <>
                  <Text style={styles.pregunta}>Detectamos que vence el</Text>
                  <Text style={styles.fecha}>{fechaLegible(fechaDetectada)}</Text>
                  <Text style={styles.pregunta}>¿Es correcto?</Text>
                </>
              ) : (
                <Text style={styles.pregunta}>
                  No encontramos la fecha de vencimiento en este documento. ¿Querés cargarla?
                </Text>
              )}

              {guardando && <ActivityIndicator style={{ marginVertical: 8 }} />}
              {errorGuardar && (
                <TarjetaError
                  variante="compacta"
                  error={errorGuardar}
                  onReintentar={() => ultimoCuerpo.current && enviar(ultimoCuerpo.current)}
                />
              )}

              {fechaDetectada ? (
                <>
                  <TouchableOpacity
                    style={[styles.boton, botonTemaRelleno]}
                    onPress={cerrar}
                    disabled={guardando}
                    accessibilityLabel="Sí, la fecha es correcta"
                  >
                    <Text style={styles.textoBoton}>Sí</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.boton, botonTemaBorde]}
                    onPress={irAElegir}
                    disabled={guardando}
                    accessibilityLabel="No, cambiar la fecha"
                  >
                    <Text style={styles.textoBoton}>No, cambiar…</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.boton, botonTemaRelleno]}
                  onPress={irAElegir}
                  disabled={guardando}
                  accessibilityLabel="Elegir la fecha de vencimiento"
                >
                  <Text style={styles.textoBoton}>Elegir fecha</Text>
                </TouchableOpacity>
              )}

              <View style={styles.separador} />

              <TouchableOpacity
                style={[styles.boton, styles.botonRojo]}
                onPress={() => enviar({ no_expiry: true })}
                disabled={guardando}
                accessibilityLabel="Este documento no vence"
              >
                <Text style={[styles.textoBoton, { color: ROJO_NO_VENCE }]}>No vence</Text>
              </TouchableOpacity>

              {!fechaDetectada && (
                <TouchableOpacity onPress={cerrar} disabled={guardando} style={styles.enlace}>
                  <Text style={styles.textoEnlace}>Más tarde</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={styles.documento} numberOfLines={1}>{nombreDocumento}</Text>
              <Text style={styles.pregunta}>Tocá el día en que vence</Text>

              <View style={styles.filaAnio}>
                <TouchableOpacity style={[styles.botonAnio, { borderColor: tema.primary }]} onPress={() => saltarAnio(-1)}>
                  <Text style={styles.textoAnio}>◀ Año</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botonAnio, { borderColor: tema.primary }]} onPress={() => saltarAnio(1)}>
                  <Text style={styles.textoAnio}>Año ▶</Text>
                </TouchableOpacity>
              </View>

              <Calendar
                key={claveCalendario}
                current={mesVisible}
                onMonthChange={(m) => setMesVisible(m.dateString)}
                onDayPress={(d) => setFechaElegida(d.dateString)}
                markedDates={fechaElegida ? { [fechaElegida]: { selected: true } } : {}}
                theme={{
                  calendarBackground: 'transparent',
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
                  weekVerticalMargin: 3,
                }}
              />

              <Text style={styles.fechaElegida}>
                {fechaElegida ? fechaLegible(fechaElegida) : 'Todavía no elegiste un día'}
              </Text>

              {guardando && <ActivityIndicator style={{ marginVertical: 8 }} />}
              {errorGuardar && (
                <TarjetaError
                  variante="compacta"
                  error={errorGuardar}
                  onReintentar={() => ultimoCuerpo.current && enviar(ultimoCuerpo.current)}
                />
              )}

              <TouchableOpacity
                style={[styles.boton, botonTemaRelleno, !fechaElegida && styles.botonDeshabilitado]}
                onPress={() => fechaElegida && enviar({ expiry_date: fechaElegida })}
                disabled={!fechaElegida || guardando}
                accessibilityLabel="Guardar fecha"
              >
                <Text style={styles.textoBoton}>Guardar fecha</Text>
              </TouchableOpacity>

              {empezarEligiendo && (
                <TouchableOpacity
                  style={[styles.boton, styles.botonRojo]}
                  onPress={() => enviar({ no_expiry: true })}
                  disabled={guardando}
                  accessibilityLabel="Este documento no vence"
                >
                  <Text style={[styles.textoBoton, { color: ROJO_NO_VENCE }]}>No vence</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  setErrorGuardar(null);
                  if (empezarEligiendo) cerrar();
                  else setModo('pregunta');
                }}
                disabled={guardando}
                style={styles.enlace}
              >
                <Text style={styles.textoEnlace}>{empezarEligiendo ? 'Cancelar' : 'Volver'}</Text>
              </TouchableOpacity>
            </>
          )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  caja: { width: '100%', borderRadius: 20, padding: 18, elevation: 8 },
  documento: { fontSize: 15, color: '#3F3F3F', textAlign: 'center', marginBottom: 6 },
  pregunta: { fontSize: 18, lineHeight: 25, color: '#1F1F1F', textAlign: 'center', marginVertical: 4 },
  fecha: { fontSize: 24, fontWeight: 'bold', color: '#1F1F1F', textAlign: 'center', marginVertical: 6 },
  boton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 10,
  },
  botonRojo: { backgroundColor: 'transparent', borderColor: ROJO_NO_VENCE },
  botonDeshabilitado: { opacity: 0.4 },
  textoBoton: { fontSize: 17, fontWeight: 'bold', color: '#1F1F1F' },
  separador: { height: 8 },
  enlace: { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  textoEnlace: { fontSize: 16, color: '#1F1F1F', textDecorationLine: 'underline' },
  filaAnio: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  botonAnio: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  textoAnio: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  fechaElegida: { fontSize: 17, fontWeight: 'bold', color: '#1F1F1F', textAlign: 'center', marginTop: 6 },
});
