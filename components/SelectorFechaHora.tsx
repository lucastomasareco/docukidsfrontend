import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { fechaCorta } from '../lib/fechas';

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

  const abrirCalendario = () => {
    setMesVisible(fecha);
    setClaveCalendario((c) => c + 1);
    setVerCalendario(true);
  };

  const saltarAnio = (delta: number) => {
    const [anio, mes] = mesVisible.split('-').map(Number);
    setMesVisible(`${anio + delta}-${dos(mes)}-01`);
    setClaveCalendario((c) => c + 1);
  };

  const abrirHora = () => {
    setHoraIOS(horaADate(hora));
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
          <Text style={[styles.campoTexto, !hora && styles.campoVacio]}>{hora || 'Sin hora (todo el día)'}</Text>
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
  enlace: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  textoEnlace: { fontSize: 17, color: '#1F1F1F', textDecorationLine: 'underline' },
  botonAceptar: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  botonAceptarTexto: { fontSize: 18, fontWeight: 'bold', color: '#1F1F1F' },
});
