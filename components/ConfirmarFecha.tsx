import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

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

type Props = {
  visible: boolean;
  docId: number;
  nombreDocumento: string;
  // Fecha que detectó el OCR ('YYYY-MM-DD') o null si no encontró ninguna.
  fechaDetectada: string | null;
  // Se llama al terminar (con o sin cambios). El padre recarga la lista.
  onTerminar: () => void;
};

export default function ConfirmarFecha({ visible, docId, nombreDocumento, fechaDetectada, onTerminar }: Props) {
  const { tema } = useTheme();
  const [modo, setModo] = useState<'pregunta' | 'elegir'>('pregunta');
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);
  const [mesVisible, setMesVisible] = useState<string>(fechaDetectada ?? hoyISO());
  // Se incrementa solo al saltar de año, para forzar al calendario a mostrar ese mes.
  const [claveCalendario, setClaveCalendario] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setModo('pregunta');
    setFechaElegida(null);
    onTerminar();
  };

  const enviar = async (cuerpo: { expiry_date: string } | { no_expiry: true }) => {
    setGuardando(true);
    try {
      await api.patch(`/documents/${docId}`, cuerpo);
      cerrar();
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      Alert.alert('No se pudo guardar', typeof detalle === 'string' ? detalle : 'Revisá la fecha e intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const irAElegir = () => {
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
        <View style={[styles.caja, { backgroundColor: tema.card }]}>
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
                <Text style={[styles.textoBoton, { color: '#fff' }]}>No vence</Text>
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
                }}
              />

              <Text style={styles.fechaElegida}>
                {fechaElegida ? fechaLegible(fechaElegida) : 'Todavía no elegiste un día'}
              </Text>

              {guardando && <ActivityIndicator style={{ marginVertical: 8 }} />}

              <TouchableOpacity
                style={[styles.boton, botonTemaRelleno, !fechaElegida && styles.botonDeshabilitado]}
                onPress={() => fechaElegida && enviar({ expiry_date: fechaElegida })}
                disabled={!fechaElegida || guardando}
                accessibilityLabel="Guardar fecha"
              >
                <Text style={styles.textoBoton}>Guardar fecha</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setModo('pregunta')} disabled={guardando} style={styles.enlace}>
                <Text style={styles.textoEnlace}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  caja: { borderRadius: 16, padding: 20, elevation: 8 },
  documento: { fontSize: 16, color: '#3F3F3F', textAlign: 'center', marginBottom: 8 },
  pregunta: { fontSize: 20, color: '#1F1F1F', textAlign: 'center', marginVertical: 4 },
  fecha: { fontSize: 26, fontWeight: 'bold', color: '#1F1F1F', textAlign: 'center', marginVertical: 8 },
  boton: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: 'center',
    marginTop: 12,
  },
  botonRojo: { backgroundColor: ROJO_NO_VENCE, borderColor: ROJO_NO_VENCE },
  botonDeshabilitado: { opacity: 0.4 },
  textoBoton: { fontSize: 20, fontWeight: 'bold', color: '#1F1F1F' },
  separador: { height: 16 },
  enlace: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  textoEnlace: { fontSize: 17, color: '#1F1F1F', textDecorationLine: 'underline' },
  filaAnio: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  botonAnio: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  textoAnio: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  fechaElegida: { fontSize: 19, fontWeight: 'bold', color: '#1F1F1F', textAlign: 'center', marginTop: 8 },
});
