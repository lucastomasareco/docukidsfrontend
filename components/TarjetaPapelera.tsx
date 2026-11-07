import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAvisos } from '../context/AvisosContext';
import { DocumentoBorrado, listarPapelera, restaurarDocumento, textoDias } from '../lib/papelera';

const TEXTO = '#1F1F1F';
const TEXTO_SUAVE = '#3F3F3F';

// "Papelera de documentos" (Ajustes). Está cerrada y no consulta Drive hasta que la persona la abre.
// Muestra los documentos que borró y todavía están en la papelera de Drive (30 días), cada uno
// con un botón Restaurar. Restaurar lo devuelve a su hijo y a su carpeta, con sus datos.
export default function TarjetaPapelera() {
  const { tema } = useTheme();
  const { mostrarError, mostrarAviso } = useAvisos();
  const [abierta, setAbierta] = useState(false);
  const [lista, setLista] = useState<DocumentoBorrado[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const ocupado = useRef(false);

  const cargar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setCargando(true);
    try {
      setLista(await listarPapelera());
    } catch (e) {
      mostrarError(e, { que: 'ver la papelera', onReintentar: cargar });
    } finally {
      ocupado.current = false;
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternar = () => {
    const abrir = !abierta;
    setAbierta(abrir);
    if (abrir) cargar();
  };

  const restaurar = async (doc: DocumentoBorrado) => {
    if (restaurandoId) return;
    setRestaurandoId(doc.drive_file_id);
    try {
      await restaurarDocumento(doc.drive_file_id);
      setLista((antes) => (antes ?? []).filter((d) => d.drive_file_id !== doc.drive_file_id));
      mostrarAviso(
        'Documento restaurado',
        `«${doc.name}» volvió a los documentos de ${doc.child_name}.`,
        { icono: 'checkmark-circle-outline' }
      );
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Ya no está en la papelera de Drive (pasaron los 30 días, se vació, o su hijo ya no existe).
        const detalle = e?.response?.data?.detail;
        mostrarAviso(
          'No se pudo restaurar',
          typeof detalle === 'string' && detalle ? detalle : 'Ese documento ya no está en la papelera de Drive.',
          { icono: 'alert-circle-outline' }
        );
        cargar();
      } else {
        mostrarError(e, { que: 'restaurar el documento', onReintentar: () => restaurar(doc) });
      }
    } finally {
      setRestaurandoId(null);
    }
  };

  return (
    <View style={[styles.tarjeta, { backgroundColor: tema.card, borderColor: tema.primary }]}>
      <TouchableOpacity
        style={styles.cabecera}
        onPress={alternar}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Papelera de documentos"
        accessibilityState={{ expanded: abierta }}
      >
        <Ionicons name="trash-outline" size={28} color={TEXTO} />
        <View style={styles.textos}>
          <Text style={styles.titulo}>Papelera de documentos</Text>
          <Text style={styles.mensaje}>Recuperá lo que borraste, hasta 30 días después.</Text>
        </View>
        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={24} color={TEXTO} />
      </TouchableOpacity>

      {abierta && (
        <View style={styles.contenido}>
          {cargando && lista === null ? (
            <ActivityIndicator color={TEXTO} style={styles.espera} />
          ) : lista && lista.length === 0 ? (
            <Text style={styles.vacio}>No hay documentos borrados para restaurar.</Text>
          ) : (
            (lista ?? []).map((doc) => (
              <View key={doc.drive_file_id} style={styles.fila}>
                <View style={styles.filaTextos}>
                  <Text style={styles.nombre}>{doc.name}</Text>
                  <Text style={styles.detalle}>De {doc.child_name}</Text>
                  <Text style={styles.detalle}>{textoDias(doc.days_left)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.boton, { backgroundColor: tema.primary }, restaurandoId !== null && styles.botonApagado]}
                  onPress={() => restaurar(doc)}
                  disabled={restaurandoId !== null}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Restaurar ${doc.name}`}
                  accessibilityState={{ disabled: restaurandoId !== null, busy: restaurandoId === doc.drive_file_id }}
                >
                  {restaurandoId === doc.drive_file_id ? (
                    <ActivityIndicator color={TEXTO} />
                  ) : (
                    <Text style={styles.textoBoton}>Restaurar</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { borderWidth: 2, borderRadius: 20, padding: 16, marginBottom: 16, alignSelf: 'stretch' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  textos: { flex: 1 },
  titulo: { fontSize: 19, fontWeight: 'bold', color: TEXTO },
  mensaje: { fontSize: 16, lineHeight: 22, color: TEXTO_SUAVE, marginTop: 2 },
  contenido: { marginTop: 8 },
  espera: { paddingVertical: 16 },
  vacio: { fontSize: 16, color: TEXTO_SUAVE, paddingVertical: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  filaTextos: { flex: 1 },
  nombre: { fontSize: 18, fontWeight: 'bold', color: TEXTO },
  detalle: { fontSize: 15, color: TEXTO_SUAVE, marginTop: 2 },
  boton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, minWidth: 110, alignItems: 'center' },
  botonApagado: { opacity: 0.5 },
  textoBoton: { fontSize: 17, fontWeight: 'bold', color: TEXTO },
});
