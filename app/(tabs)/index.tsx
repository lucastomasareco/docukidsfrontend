import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../lib/api';
import { useChildren } from '../../context/ChildrenContext';

type Documento = {
  id: number;
  name: string;
  expiry_date: string | null;
  status: 'vigente' | 'proximo' | 'vencido' | 'sin_fecha';
  drive_link: string | null;
};

type ArchivoElegido = {
  uri: string;
  mimeType: string;
  nombreArchivo: string;
};

const COLOR_POR_ESTADO: Record<Documento['status'], string> = {
  vigente: '#2e7d32',
  proximo: '#f57c00',
  vencido: '#c62828',
  sin_fecha: '#9e9e9e',
};

const TEXTO_POR_ESTADO: Record<Documento['status'], string> = {
  vigente: 'Vigente',
  proximo: 'Vence pronto',
  vencido: 'Vencido',
  sin_fecha: 'Sin fecha',
};

export default function Docs() {
  const { hijos, seleccionadoId, cargando: cargandoHijos } = useChildren();
  const hijoSeleccionado = hijos.find((h) => h.id === seleccionadoId);

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [archivoElegido, setArchivoElegido] = useState<ArchivoElegido | null>(null);
  const [nombreDocumento, setNombreDocumento] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const cargarDocumentos = useCallback(async () => {
    if (!seleccionadoId) {
      setDocumentos([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const respuesta = await api.get(`/documents/${seleccionadoId}`);
      setDocumentos(respuesta.data.documents);
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      setError(detalle);
    } finally {
      setCargando(false);
    }
  }, [seleccionadoId]);

  useFocusEffect(
    useCallback(() => {
      cargarDocumentos();
    }, [cargarDocumentos])
  );

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setArchivoElegido(null);
    setNombreDocumento('');
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Docukids necesita acceso a tus fotos para subir documentos.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (resultado.canceled || resultado.assets.length === 0) return;
    const asset = resultado.assets[0];
    setArchivoElegido({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      nombreArchivo: asset.fileName || `documento_${Date.now()}.jpg`,
    });
    setMostrarFormulario(true);
  };

  const tomarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Docukids necesita acceso a la cámara para sacar la foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (resultado.canceled || resultado.assets.length === 0) return;
    const asset = resultado.assets[0];
    setArchivoElegido({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      nombreArchivo: asset.fileName || `documento_${Date.now()}.jpg`,
    });
    setMostrarFormulario(true);
  };

  const elegirPDF = async () => {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (resultado.canceled || !resultado.assets || resultado.assets.length === 0) return;
    const asset = resultado.assets[0];
    setArchivoElegido({
      uri: asset.uri,
      mimeType: asset.mimeType || 'application/pdf',
      nombreArchivo: asset.name || `documento_${Date.now()}.pdf`,
    });
    setMostrarFormulario(true);
  };

  const abrirOpciones = () => {
    setMostrarMenu(true);
  };

  const elegirOpcion = (accion: () => void) => {
    setMostrarMenu(false);
    accion();
  };

  const subirDocumento = async () => {
    if (!archivoElegido || !seleccionadoId) return;
    if (!nombreDocumento.trim()) {
      Alert.alert('Falta el nombre', 'Escribí un nombre para el documento (ej. "DNI").');
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: archivoElegido.uri,
      name: archivoElegido.nombreArchivo,
      type: archivoElegido.mimeType,
    } as any);
    formData.append('child_id', String(seleccionadoId));
    formData.append('name', nombreDocumento.trim());

    setSubiendo(true);
    try {
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      cerrarFormulario();
      cargarDocumentos();
    } catch (e: any) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
      Alert.alert('No se pudo subir', detalle);
    } finally {
      setSubiendo(false);
    }
  };

  const borrarDocumento = (doc: Documento) => {
    Alert.alert('Borrar documento', `¿Seguro que querés borrar "${doc.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/documents/${doc.id}`);
            cargarDocumentos();
          } catch (e: any) {
            const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido';
            Alert.alert('No se pudo borrar', detalle);
          }
        },
      },
    ]);
  };

  if (cargandoHijos && hijos.length === 0) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!seleccionadoId) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacio}>Primero agregá y seleccioná un hijo en la pestaña "Hijos".</Text>
      </View>
    );
  }

  const esImagen = archivoElegido?.mimeType.startsWith('image/');

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mis Documentos</Text>
      <Text style={styles.subtitulo}>{hijoSeleccionado?.name}</Text>

      {cargando ? (
        <View style={styles.centroFlex}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.centroFlex}>
          <Text style={styles.textoError}>No se pudo cargar: {error}</Text>
          <TouchableOpacity style={styles.botonReintentar} onPress={cargarDocumentos}>
            <Text style={styles.botonTexto}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : documentos.length === 0 ? (
        <Text style={styles.vacio}>{hijoSeleccionado?.name} todavía no tiene documentos.</Text>
      ) : (
        <>
          <Text style={styles.ayuda}>Mantené presionado un documento para borrarlo.</Text>
          <FlatList
            data={documentos}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onLongPress={() => borrarDocumento(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.punto, { backgroundColor: COLOR_POR_ESTADO[item.status] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre}>{item.name}</Text>
                  <Text style={styles.estado}>
                    {TEXTO_POR_ESTADO[item.status]}
                    {item.expiry_date ? ` · ${item.expiry_date}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {mostrarFormulario && archivoElegido && (
        <View style={styles.formulario}>
          {esImagen ? (
            <Image source={{ uri: archivoElegido.uri }} style={styles.previsualizacion} />
          ) : (
            <View style={styles.previsualizacionPDF}>
              <Text style={styles.iconoPDF}>📄</Text>
              <Text style={styles.nombrePDF} numberOfLines={1}>
                {archivoElegido.nombreArchivo}
              </Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder='Nombre del documento (ej. "DNI")'
            value={nombreDocumento}
            onChangeText={setNombreDocumento}
            autoFocus
          />
          <View style={styles.filaBotones}>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonCancelar]}
              onPress={cerrarFormulario}
              disabled={subiendo}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar]}
              onPress={subirDocumento}
              disabled={subiendo}
            >
              <Text style={styles.botonTexto}>{subiendo ? 'Subiendo...' : 'Subir'}</Text>
            </TouchableOpacity>
          </View>
          {subiendo && (
            <Text style={styles.textoSubiendo}>Subiendo a Drive y leyendo la fecha, puede tardar...</Text>
          )}
        </View>
      )}

      {!mostrarFormulario && (
        <TouchableOpacity style={styles.fab} onPress={abrirOpciones}>
          <Text style={styles.fabTexto}>+</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={mostrarMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarMenu(false)}
      >
        <TouchableOpacity
          style={styles.fondoMenu}
          activeOpacity={1}
          onPress={() => setMostrarMenu(false)}
        >
          <View style={styles.menu} onStartShouldSetResponder={() => true}>
            <Text style={styles.menuTitulo}>Agregar documento</Text>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => elegirOpcion(tomarFoto)}>
              <Text style={styles.menuOpcionTexto}>Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => elegirOpcion(elegirDeGaleria)}>
              <Text style={styles.menuOpcionTexto}>Elegir de galería</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOpcion} onPress={() => elegirOpcion(elegirPDF)}>
              <Text style={styles.menuOpcionTexto}>Elegir PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancelar} onPress={() => setMostrarMenu(false)}>
              <Text style={styles.menuCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 60 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centroFlex: { alignItems: 'center', marginTop: 40, gap: 12 },
  textoError: { textAlign: 'center', color: '#c62828' },
  botonReintentar: { backgroundColor: '#1976d2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  subtitulo: { fontSize: 15, color: '#666', marginBottom: 12 },
  ayuda: { fontSize: 12, color: '#999', marginBottom: 8 },
  vacio: { color: '#666', marginTop: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  punto: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  nombre: { fontSize: 16, fontWeight: '600' },
  estado: { fontSize: 13, color: '#666' },
  botonTexto: { color: '#fff', fontWeight: 'bold' },
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
  fabTexto: { color: '#fff', fontSize: 28, lineHeight: 30 },
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
  previsualizacion: { width: '100%', height: 140, borderRadius: 8, marginBottom: 12, resizeMode: 'cover' },
  previsualizacionPDF: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconoPDF: { fontSize: 28, marginBottom: 4 },
  nombrePDF: { fontSize: 13, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#999' },
  botonGuardar: { backgroundColor: '#1976d2' },
  textoSubiendo: { fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' },
  fondoMenu: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menu: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  menuTitulo: { fontSize: 15, color: '#999', marginBottom: 8, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#eee' },
  menuOpcionTexto: { fontSize: 16, textAlign: 'center', color: '#1976d2' },
  menuCancelar: { paddingVertical: 14, marginTop: 8 },
  menuCancelarTexto: { fontSize: 16, textAlign: 'center', color: '#c62828', fontWeight: 'bold' },
});