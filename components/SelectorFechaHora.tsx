import { useState, createElement } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { fechaCorta } from '../lib/fechas';
import RelojCircular from './RelojCircular';

// Selector de fecha + hora para el formulario de turnos.
//  - Fecha: calendario (react-native-calendars, ya instalado). Se muestra dd/mm/aaaa.
//  - Hora: selector nativo del teléfono, 24 hs. Es OPCIONAL: sin hora, el backend
//    crea el evento de todo el día en Google Calendar.
// El español del calendario ya está registrado en calendario.tsx / ConfirmarFecha.

type Props = {
  fecha: string; // 'AAAA-MM-DD'
  onCambiarFecha: (iso: string) => void;
  hora: string; // 'HH:MM' o '' (sin hora)
  onCambiarHora: (hhmm: string) => void;
};

const dos = (n: number) => String(n).padStart(2, '0');

// 'HH:MM' -> Date de hoy con esa hora (el picker nativo trabaja con Date).
function horaADate(hora: string): Date {
  const d = new Date();
  const [h, m] = hora ? hora.split(':').map(Number) : [9, 0]; // por defecto 09:00
  d.setHours(h, m, 0, 0);
  return d;
}

export default function SelectorFechaHora({ fecha, onCambiarFecha, hora, onCambiarHora }: Props) {
  const { tema } = useTheme();
  const [verCalendario, setVerCalendario] = useState(false);
  const [verHora, setVerHora] = useState(false);
  const [claveCalendario, setClaveCalendario] = useState(0);
  const [mesVisible, setMesVisible] = useState(fecha);
  const [horaIOS, setHoraIOS] = useState<Date>(horaADate(hora)); // solo iOS (confirma con "Aceptar")
  const [horaWeb, setHoraWeb] = useState<string>(hora || '09:00'); // solo web (versión de escritorio)
  const [horaConTeclado, setHoraConTeclado] = useState(false); // solo web: true = escribir la hora
  const [fechaEscrita, setFechaEscrita] = useState(''); // solo web: fecha escrita con el teclado
  const [errorFechaEscrita, setErrorFechaEscrita] = useState('');

  const abrirCalendario = () => {
    setMesVisible(fecha);
    setClaveCalendario((c) => c + 1);
    setFechaEscrita('');
    setErrorFechaEscrita('');
    setVerCalendario(true);
  };

  const saltarAnio = (delta: number) => {
    const [anio, mes] = mesVisible.split('-').map(Number);
    setMesVisible(`${anio + delta}-${dos(mes)}-01`);
    setClaveCalendario((c) => c + 1);
  };

  // Web: formatea mientras se escribe (solo números; las barras se ponen solas).
  const formatearEscrita = (texto: string) => {
    const d = texto.replace(/\D/g, '').slice(0, 8);
    let salida = d.slice(0, 2);
    if (d.length > 2) salida += '/' + d.slice(2, 4);
    if (d.length > 4) salida += '/' + d.slice(4);
    return salida;
  };

  // Web: valida la fecha escrita (dd/mm/aaaa) y, si existe de verdad, la usa.
  const usarFechaEscrita = () => {
    const m = fechaEscrita.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) {
      setErrorFechaEscrita('Escribila así: 15/03/2026');
      return;
    }
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const anio = Number(m[3]);
    const f = new Date(anio, mes - 1, dia);
    if (anio < 2000 || f.getFullYear() !== anio || f.getMonth() !== mes - 1 || f.getDate() !== dia) {
      setErrorFechaEscrita('Esa fecha no existe. Revisá el día, el mes y el año.');
      return;
    }
    onCambiarFecha(`${m[3]}-${m[2]}-${m[1]}`);
    setVerCalendario(false);
  };

  const abrirHora = () => {
    setHoraIOS(horaADate(hora));
    setHoraWeb(hora || '09:00');
    setHoraConTeclado(false);
    setVerHora(true);
  };

  return (
    <View>
      <Text style={styles.etiqueta}>Fecha</Text>
      <TouchableOpacity style={styles.campo} onPress={abrirCalendario} accessibilityLabel="Elegir la fecha del turno">
        <Text style={styles.campoTexto}>{fechaCorta(fecha)}</Text>
      </TouchableOpacity>

      <Text style={styles.etiqueta}>Hora (opcional)</Text>
      <View style={styles.filaHora}>
        <TouchableOpacity
          style={[styles.campo, { flex: 1, marginBottom: 0 }]}
          onPress={abrirHora}
          accessibilityLabel="Elegir la hora del turno"
        >
          <Text style={[styles.campoTexto, !hora && styles.campoVacio]}>{hora ? horaEnPalabras(hora) : 'Sin hora (todo el día)'}</Text>
        </TouchableOpacity>
        {!!hora && (
          <TouchableOpacity
            style={[styles.botonQuitar, { borderColor: tema.primary }]}
            onPress={() => onCambiarHora('')}
            accessibilityLabel="Quitar la hora"
          >
            <Text style={styles.botonQuitarTexto}>Quitar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ---- Calendario para la fecha ---- */}
      <Modal visible={verCalendario} transparent animationType="fade" onRequestClose={() => setVerCalendario(false)}>
        <View style={styles.fondo}>
          <View style={[styles.caja, { backgroundColor: tema.bar }]}>
            <Text style={styles.titulo}>Tocá el día del turno</Text>
            {Platform.OS === 'web' && (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.etiqueta}>O escribí la fecha (día/mes/año)</Text>
                <View style={styles.filaHora}>
                  <TextInput
                    style={[styles.campo, styles.campoTexto, { flex: 1, marginBottom: 0, backgroundColor: '#FFFFFF' }]}
                    value={fechaEscrita}
                    onChangeText={(t) => {
                      setFechaEscrita(formatearEscrita(t));
                      setErrorFechaEscrita('');
                    }}
                    onSubmitEditing={usarFechaEscrita}
                    placeholder="15/03/2026"
                    placeholderTextColor="#5F5F5F"
                    maxLength={10}
                    accessibilityLabel="Escribir la fecha del turno"
                  />
                  <TouchableOpacity
                    style={[styles.botonQuitar, { borderColor: tema.primary, backgroundColor: tema.primary }]}
                    onPress={usarFechaEscrita}
                    accessibilityLabel="Usar la fecha escrita"
                  >
                    <Text style={styles.botonQuitarTexto}>Usar</Text>
                  </TouchableOpacity>
                </View>
                {!!errorFechaEscrita && <Text style={styles.errorEscrita}>{errorFechaEscrita}</Text>}
              </View>
            )}
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
              onDayPress={(d) => {
                onCambiarFecha(d.dateString);
                setVerCalendario(false);
              }}
              markedDates={{ [fecha]: { selected: true } }}
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
            <TouchableOpacity onPress={() => setVerCalendario(false)} style={styles.enlace}>
              <Text style={styles.textoEnlace}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---- Hora: Android = diálogo nativo; iOS = ruedita dentro de un modal ---- */}
      {verHora && Platform.OS === 'android' && (
        <DateTimePicker
          value={horaADate(hora)}
          mode="time"
          is24Hour
          // onValueChange = la persona confirmó una hora; onDismiss = canceló.
          // (onChange quedó en desuso en la versión 9 del paquete.)
          onValueChange={(_evento, elegida) => {
            setVerHora(false);
            if (elegida) onCambiarHora(`${dos(elegida.getHours())}:${dos(elegida.getMinutes())}`);
          }}
          onDismiss={() => setVerHora(false)}
        />
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={verHora} transparent animationType="fade" onRequestClose={() => setVerHora(false)}>
          <View style={styles.fondo}>
            <View style={[styles.caja, { backgroundColor: tema.bar }]}>
              <Text style={styles.titulo}>Elegí la hora</Text>
              <DateTimePicker
                value={horaIOS}
                mode="time"
                is24Hour
                display="spinner"
                onValueChange={(_evento, elegida) => elegida && setHoraIOS(elegida)}
              />
              <TouchableOpacity
                style={[styles.botonAceptar, { backgroundColor: tema.primary }]}
                onPress={() => {
                  onCambiarHora(`${dos(horaIOS.getHours())}:${dos(horaIOS.getMinutes())}`);
                  setVerHora(false);
                }}
              >
                <Text style={styles.botonAceptarTexto}>Aceptar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setVerHora(false)} style={styles.enlace}>
                <Text style={styles.textoEnlace}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* ---- Hora en la web (app de escritorio): el DateTimePicker no existe en la web,
           así que se usa el selector de hora del navegador (<input type="time">). ---- */}
      {Platform.OS === 'web' && (
        <Modal visible={verHora} transparent animationType="fade" onRequestClose={() => setVerHora(false)}>
          <View style={styles.fondo}>
            <View style={[styles.caja, { backgroundColor: tema.bar }]}>
              <Text style={styles.titulo}>Elegí la hora</Text>
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                {horaConTeclado
                  ? createElement('input', {
                      type: 'time',
                      value: horaWeb,
                      autoFocus: true,
                      onChange: (e: any) => setHoraWeb(e.target.value),
                      style: {
                        fontSize: '28px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid #ccc',
                        color: '#1F1F1F',
                        backgroundColor: '#FFFFFF',
                      },
                    })
                  : <RelojCircular valor={horaWeb} onCambiar={setHoraWeb} colorPrincipal={tema.primary} />}
              </View>
              <TouchableOpacity onPress={() => setHoraConTeclado((v) => !v)} style={styles.enlace}>
                <Text style={styles.textoEnlace}>{horaConTeclado ? 'Usar el reloj' : 'Escribir la hora con el teclado'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonAceptar, { backgroundColor: tema.primary }]}
                onPress={() => {
                  if (horaWeb) onCambiarHora(horaWeb);
                  setVerHora(false);
                }}
              >
                <Text style={styles.botonAceptarTexto}>Aceptar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setVerHora(false)} style={styles.enlace}>
                <Text style={styles.textoEnlace}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: { fontSize: 14, color: '#3F3F3F', marginBottom: 4 },
  campo: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 10 },
  campoTexto: { fontSize: 16, color: '#1F1F1F' },
  campoVacio: { color: '#5F5F5F' },
  filaHora: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  botonQuitar: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  botonQuitarTexto: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  caja: { borderRadius: 16, padding: 20, elevation: 8 },
  titulo: { fontSize: 20, color: '#1F1F1F', textAlign: 'center', marginBottom: 8 },
  filaAnio: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  botonAnio: { borderWidth: 2, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  textoAnio: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  errorEscrita: { fontSize: 14, color: '#8A1C1C', marginTop: 6 },
  enlace: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  textoEnlace: { fontSize: 17, color: '#1F1F1F', textDecorationLine: 'underline' },
  botonAceptar: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  botonAceptarTexto: { fontSize: 18, fontWeight: 'bold', color: '#1F1F1F' },
});
