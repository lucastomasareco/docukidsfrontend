import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { ErrorAmigable, interpretarError } from '../lib/errores';
import { TarjetaError } from './AvisoError';

// Sección "Documentos" del formulario de turno: se eligen documentos que YA están en Docs del niño
// (por ejemplo "Análisis de sangre" para el turno del pediatra). Es opcional y se pueden elegir varios.
// Solo guarda los ids; el vínculo lo guarda el backend al guardar el turno.
type DocumentoLista = { id: number; name: string };

type Props = {
  childId: number | null;
  seleccionados: number[];
  onCambiar: (ids: number[]) => void;
  deshabilitado?: boolean;
};

export default function SelectorDocumentos({ childId, seleccionados, onCambiar, deshabilitado = false }: Props) {
  const { tema } = useTheme();
  const [abierto, setAbierto] = useState(seleccionados.length > 0);
  const [documentos, setDocumentos] = useState<DocumentoLista[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<ErrorAmigable | null>(null);

  const cargar = useCallback(async () => {
    if (!childId) return;
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.get(`/documents/${childId}`);
      const lista: DocumentoLista[] = respuesta.data.documents.map((d: DocumentoLista) => ({ id: d.id, name: d.name }));
      setDocumentos(lista);
      // Si un documento vinculado se borró desde Docs, ya no existe: se saca de la selección
      // (si no, el backend rechazaría el guardado).
      const existentes = new Set(lista.map((d) => d.id));
      const vigentes = seleccionados.filter((id) => existentes.has(id));
      if (vigentes.length !== seleccionados.length) onCambiar(vigentes);
    } catch (e) {
      setError(interpretarError(e, 'cargar los documentos'));
    } finally {
      setCargando(false);
    }
    // seleccionados/onCambiar se leen solo al cargar: no hace falta recargar cada vez que se tocan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  useEffect(() => {
    if (abierto && documentos === null && !cargando && !error) cargar();
  }, [abierto, documentos, cargando, error, cargar]);

  const alternar = (id: number) => {
    onCambiar(seleccionados.includes(id) ? seleccionados.filter((x) => x !== id) : [...seleccionados, id]);
  };

  if (!abierto) {
    return (
      <TouchableOpacity
        style={[styles.botonAgregar, { borderColor: tema.primary }]}
        onPress={() => setAbierto(true)}
        disabled={deshabilitado}
        activeOpacity={0.7}
        accessibilityLabel="Agregar un documento al turno"
      >
        <Ionicons name="document-text-outline" size={22} color="#1F1F1F" />
        <Text style={styles.botonAgregarTexto}>Agregar documento (opcional)</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.seccion, { borderColor: tema.primary }]}>
      <View style={styles.encabezado}>
        <Ionicons name="document-text" size={20} color="#1F1F1F" />
        <Text style={styles.titulo}>Documentos</Text>
        {seleccionados.length > 0 && (
          <TouchableOpacity
            onPress={() => onCambiar([])}
            disabled={deshabilitado}
            accessibilityLabel="Quitar todos los documentos del turno"
            style={styles.quitar}
          >
            <Text style={styles.quitarTexto}>Quitar todos</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.pista}>Tocá los documentos del niño que querés vincular a este turno.</Text>

      {cargando && <ActivityIndicator style={{ marginVertical: 8 }} />}
      {error && <TarjetaError variante="compacta" error={error} onReintentar={cargar} />}

      {documentos && documentos.length === 0 && (
        <Text style={styles.pista}>Todavía no tiene documentos. Subilos desde la pestaña Docs.</Text>
      )}

      {documentos && documentos.length > 0 && (
        <ScrollView style={styles.lista} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {documentos.map((d) => {
            const elegido = seleccionados.includes(d.id);
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.fila, elegido && { backgroundColor: tema.primary, borderColor: tema.primary }]}
                onPress={() => alternar(d.id)}
                disabled={deshabilitado}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: elegido }}
                accessibilityLabel={d.name}
              >
                <Ionicons name={elegido ? 'checkbox' : 'square-outline'} size={22} color="#1F1F1F" />
                <Text style={[styles.filaTexto, elegido && styles.filaTextoElegida]} numberOfLines={2}>
                  {d.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
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
  pista: { fontSize: 13, color: '#3F3F3F', marginBottom: 6 },
  lista: { maxHeight: 220 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  filaTexto: { flex: 1, fontSize: 15, color: '#1F1F1F' },
  filaTextoElegida: { fontWeight: 'bold' },
});
