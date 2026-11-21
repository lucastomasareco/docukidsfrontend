import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VentanaMapa from './VentanaMapa';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { ErrorAmigable, interpretarError } from '../lib/errores';
import { fechaCorta } from '../lib/fechas';
import { hayProximosConLugar, Lugar, tituloDeLugar, TurnoConLugar, UltimoLugar, ultimosLugares } from '../lib/lugares';

// "Últimos lugares" de un hijo: dónde fue a sus turnos anteriores (pediatra, laboratorio...),
// sin repetir y del más reciente al más antiguo. Sirve para que cualquiera de la familia
// sepa dónde fue la última vez. Los datos salen de los turnos que ya existen (no hay endpoint nuevo).
// Tocar un lugar abre su mapa con "Cómo llegar".
type Props = { hijoId: number; hijoNombre: string; onCerrar: () => void };

export default function UltimosLugares({ hijoId, hijoNombre, onCerrar }: Props) {
  const { tema } = useTheme();
  const [lugares, setLugares] = useState<UltimoLugar[] | null>(null);
  const [hayProximos, setHayProximos] = useState(false);
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const [cargando, setCargando] = useState(true);
  const [verMapa, setVerMapa] = useState<Lugar | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await api.get(`/appointments/${hijoId}`);
      const turnos = r.data.appointments as TurnoConLugar[];
      setLugares(ultimosLugares(turnos));
      setHayProximos(hayProximosConLugar(turnos));
    } catch (e) {
      setError(interpretarError(e, 'cargar los lugares'));
    } finally {
      setCargando(false);
    }
  }, [hijoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
        <Pressable style={styles.fondo} onPress={onCerrar} accessibilityLabel="Cerrar">
          <Pressable style={[styles.caja, { backgroundColor: tema.card }]} onPress={() => {}}>
            <View style={styles.encabezado}>
              <Ionicons name="location" size={24} color="#1F1F1F" />
              <Text style={styles.titulo} numberOfLines={2}>Últimos lugares de {hijoNombre}</Text>
            </View>

            {cargando ? (
              <View style={styles.centro}>
                <ActivityIndicator size="large" color={tema.primary} />
                <Text style={styles.texto}>Buscando…</Text>
              </View>
            ) : error ? (
              <View style={styles.centro}>
                <Text style={styles.subtitulo}>{error.titulo}</Text>
                <Text style={styles.texto}>{error.mensaje}</Text>
                <TouchableOpacity style={[styles.boton, { backgroundColor: tema.primary, borderColor: tema.primary }]} onPress={cargar}>
                  <Text style={styles.textoBoton}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : lugares && lugares.length > 0 ? (
              <ScrollView style={styles.lista} contentContainerStyle={{ gap: 8 }}>
                <Text style={styles.texto}>Tocá un lugar para verlo en el mapa.</Text>
                {lugares.map((u, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.fila}
                    onPress={() => setVerMapa(u.lugar)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Ver en el mapa: ${tituloDeLugar(u.lugar)}`}
                  >
                    <Ionicons name="location-outline" size={22} color="#1F1F1F" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.filaTitulo} numberOfLines={1}>{tituloDeLugar(u.lugar)}</Text>
                      {u.lugar.nombre.trim() && u.lugar.direccion.trim() ? (
                        <Text style={styles.filaDireccion} numberOfLines={2}>{u.lugar.direccion}</Text>
                      ) : null}
                      <Text style={styles.filaFecha}>
                        {i === 0 ? 'La última vez: ' : 'Último turno: '}
                        {u.turnoTitulo} · {fechaCorta(u.fecha)}
                        {u.veces > 1 ? ` · ${u.veces} turnos acá` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#3F3F3F" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.centro}>
                <Text style={styles.texto}>
                  {hayProximos
                    ? `${hijoNombre} todavía no fue a ningún turno con lugar, pero hay uno agendado. Lo vas a ver acá cuando pase.`
                    : 'Todavía no hay turnos pasados con lugar. Al crear o editar un turno, agregale el lugar (el botón “Agregar lugar”) y va a aparecer acá.'}
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.boton, { borderColor: tema.primary }]} onPress={onCerrar} accessibilityLabel="Cerrar">
              <Text style={styles.textoBoton}>Cerrar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      {verMapa && <VentanaMapa lugar={verMapa} onCerrar={() => setVerMapa(null)} />}
    </>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  caja: { width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: 24, padding: 18, elevation: 10 },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  titulo: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1F1F1F' },
  lista: { flexGrow: 0 },
  centro: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  subtitulo: { fontSize: 17, fontWeight: 'bold', color: '#1F1F1F', textAlign: 'center' },
  texto: { fontSize: 15, color: '#3F3F3F', textAlign: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12 },
  filaTitulo: { fontSize: 17, fontWeight: 'bold', color: '#1F1F1F' },
  filaDireccion: { fontSize: 13, color: '#3F3F3F' },
  filaFecha: { fontSize: 13, color: '#1F1F1F', marginTop: 2 },
  boton: { alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, borderWidth: 3, marginTop: 12 },
  textoBoton: { fontSize: 18, fontWeight: 'bold', color: '#1F1F1F' },
});
