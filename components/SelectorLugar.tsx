import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapaLugar from './MapaLugar';
import { useTheme } from '../context/ThemeContext';
import { useAvisos } from '../context/AvisosContext';
import {
  buscarLugares,
  LUGAR_VACIO,
  Lugar,
  lugarDePunto,
  mensajeDeBuscador,
  ResultadoLugar,
  tieneLugar,
  tieneUbicacion,
} from '../lib/lugares';

// Sección "Lugar" del formulario de turno. Dos formas de indicar dónde es, que se pueden combinar:
//   1) escribir la dirección (o el nombre del consultorio) y tocar Buscar → elegir un resultado;
//   2) tocar el mapa (o arrastrar el pin): queda guardada esa ubicación y se completa la dirección sola.
// Todo es opcional: un turno puede tener solo nombre, solo dirección, o también el pin.
type Props = {
  lugar: Lugar;
  onCambiar: (lugar: Lugar) => void;
  deshabilitado?: boolean;
};

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

export default function SelectorLugar({ lugar, onCambiar, deshabilitado = false }: Props) {
  const { tema } = useTheme();
  const { mostrarError, mostrarAviso } = useAvisos();
  const [abierto, setAbierto] = useState(tieneLugar(lugar));
  const [resultados, setResultados] = useState<ResultadoLugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [enfocar, setEnfocar] = useState(0);

  // Siempre el lugar más nuevo, para que las respuestas que llegan tarde no pisen cambios recientes.
  const lugarActual = useRef(lugar);
  lugarActual.current = lugar;
  const consultaDePunto = useRef(0);

  const buscar = async () => {
    const texto = (lugar.direccion.trim() || lugar.nombre.trim()).replace(/\s+/g, ' ');
    if (texto.length < 3) {
      mostrarAviso('Escribí qué buscar', 'Escribí la dirección o el nombre del consultorio (al menos 3 letras).', {
        icono: 'create-outline',
      });
      return;
    }
    setBuscando(true);
    try {
      const encontrados = await buscarLugares(texto);
      if (encontrados.length === 0) {
        setResultados(null);
        mostrarAviso(
          'No encontramos ese lugar',
          'Probá con la calle y la ciudad, o tocá el mapa para marcar el lugar a mano.',
          { icono: 'search-outline' }
        );
      } else {
        setResultados(encontrados);
      }
    } catch (e: any) {
      const propio = mensajeDeBuscador(e);
      if (propio) mostrarAviso('El buscador no responde', propio, { icono: 'map-outline' });
      else mostrarError(e, { que: 'buscar el lugar', onReintentar: buscar });
    } finally {
      setBuscando(false);
    }
  };

  const elegirResultado = (r: ResultadoLugar) => {
    onCambiar({
      nombre: lugar.nombre.trim() ? lugar.nombre : r.name ?? '',
      direccion: r.address ?? lugar.direccion,
      lat: redondear(r.lat),
      lon: redondear(r.lon),
    });
    setResultados(null);
    setEnfocar((n) => n + 1);
  };

  // Tocar el mapa o soltar el pin: la ubicación se guarda al instante; la dirección se completa después.
  const elegirEnMapa = async (lat: number, lon: number) => {
    const la = redondear(lat);
    const lo = redondear(lon);
    onCambiar({ ...lugarActual.current, lat: la, lon: lo });
    setResultados(null);
    const miConsulta = ++consultaDePunto.current;
    setBuscandoDireccion(true);
    try {
      const r = await lugarDePunto(la, lo);
      // Si en el medio se movió el pin otra vez, esta respuesta ya no corresponde.
      if (miConsulta === consultaDePunto.current && r.address) {
        onCambiar({ ...lugarActual.current, direccion: r.address });
      }
    } catch {
      // Sin dirección no pasa nada: la ubicación ya quedó guardada y la dirección se puede escribir a mano.
    } finally {
      if (miConsulta === consultaDePunto.current) setBuscandoDireccion(false);
    }
  };

  const quitar = () => {
    consultaDePunto.current++;
    setBuscandoDireccion(false);
    setResultados(null);
    onCambiar(LUGAR_VACIO);
    setAbierto(false);
  };

  if (!abierto) {
    return (
      <TouchableOpacity
        style={[styles.botonAgregar, { borderColor: tema.primary }]}
        onPress={() => setAbierto(true)}
        disabled={deshabilitado}
        activeOpacity={0.7}
        accessibilityLabel="Agregar el lugar del turno"
      >
        <Ionicons name="location-outline" size={22} color="#1F1F1F" />
        <Text style={styles.botonAgregarTexto}>Agregar lugar (opcional)</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.seccion, { borderColor: tema.primary }]}>
      <View style={styles.encabezado}>
        <Ionicons name="location" size={20} color="#1F1F1F" />
        <Text style={styles.titulo}>Lugar</Text>
        {tieneLugar(lugar) && (
          <TouchableOpacity onPress={quitar} disabled={deshabilitado} accessibilityLabel="Quitar el lugar" style={styles.quitar}>
            <Text style={styles.quitarTexto}>Quitar lugar</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        placeholderTextColor="#5F5F5F"
        style={styles.input}
        placeholder='Nombre del lugar (ej. "Dr. Pérez")'
        value={lugar.nombre}
        onChangeText={(t) => onCambiar({ ...lugar, nombre: t })}
        editable={!deshabilitado}
        maxLength={300}
      />

      <View style={styles.filaBusqueda}>
        <TextInput
          placeholderTextColor="#5F5F5F"
          style={[styles.input, styles.inputBusqueda]}
          placeholder="Dirección (ej. Av. Corrientes 1234, Buenos Aires)"
          value={lugar.direccion}
          onChangeText={(t) => onCambiar({ ...lugar, direccion: t })}
          onSubmitEditing={buscar}
          returnKeyType="search"
          editable={!deshabilitado}
          maxLength={300}
        />
        <TouchableOpacity
          style={[styles.botonBuscar, { backgroundColor: tema.primary }]}
          onPress={buscar}
          disabled={buscando || deshabilitado}
          activeOpacity={0.8}
          accessibilityLabel="Buscar la dirección en el mapa"
        >
          {buscando ? (
            <ActivityIndicator color="#1F1F1F" />
          ) : (
            <>
              <Ionicons name="search" size={18} color="#1F1F1F" />
              <Text style={styles.botonBuscarTexto}>Buscar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {resultados && (
        <View style={styles.resultados}>
          <Text style={styles.pista}>Tocá el que corresponde:</Text>
          {resultados.map((r, i) => (
            <TouchableOpacity
              key={`${r.lat},${r.lon},${i}`}
              style={styles.resultado}
              onPress={() => elegirResultado(r)}
              activeOpacity={0.7}
              accessibilityLabel={`Elegir ${r.name ?? r.address ?? 'este lugar'}`}
            >
              <Ionicons name="location-outline" size={20} color="#1F1F1F" />
              <View style={{ flex: 1 }}>
                {r.name ? <Text style={styles.resultadoNombre} numberOfLines={1}>{r.name}</Text> : null}
                <Text style={styles.resultadoDireccion} numberOfLines={2}>{r.address ?? 'Sin dirección'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setResultados(null)} style={styles.cerrarResultados}>
            <Text style={styles.quitarTexto}>Ninguno es el correcto</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.pista}>
        {tieneUbicacion(lugar)
          ? 'Podés mover el pin o tocar otro punto del mapa para cambiar la ubicación.'
          : 'También podés tocar el mapa para marcar el lugar.'}
      </Text>
      <MapaLugar lat={lugar.lat} lon={lugar.lon} editable={!deshabilitado} onElegir={elegirEnMapa} enfocar={enfocar} altura={240} />
      {buscandoDireccion && <Text style={styles.pista}>Buscando la dirección de ese punto…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  botonAgregar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 10,
  },
  botonAgregarTexto: { fontSize: 16, color: '#1F1F1F', fontWeight: '600' },
  seccion: { borderWidth: 2, borderRadius: 10, padding: 10, marginBottom: 10 },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  titulo: { fontSize: 16, fontWeight: 'bold', color: '#1F1F1F', flex: 1 },
  quitar: { paddingVertical: 4, paddingHorizontal: 6 },
  quitarTexto: { color: '#c62828', fontWeight: '600', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16, color: '#1F1F1F' },
  filaBusqueda: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  inputBusqueda: { flex: 1, minWidth: 0 },
  botonBuscar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 44, borderRadius: 8, justifyContent: 'center' },
  botonBuscarTexto: { fontSize: 16, fontWeight: 'bold', color: '#1F1F1F' },
  resultados: { marginBottom: 10, gap: 6 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f5f5', borderRadius: 8, padding: 10 },
  resultadoNombre: { fontSize: 15, fontWeight: 'bold', color: '#1F1F1F' },
  resultadoDireccion: { fontSize: 13, color: '#3F3F3F' },
  cerrarResultados: { alignSelf: 'flex-start', paddingVertical: 4 },
  pista: { fontSize: 13, color: '#3F3F3F', marginBottom: 6 },
});
