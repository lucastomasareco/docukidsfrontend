import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient'; // <-- IMPORT AGREGADO
import { api } from '../../lib/api';
import { useChildren } from '../../context/ChildrenContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useAvisos } from '../../context/AvisosContext';
import { TarjetaError } from '../../components/AvisoError';
import EsperaServidor from '../../components/EsperaServidor';
import EstadoVacio from '../../components/EstadoVacio';
import { ErrorAmigable, interpretarError } from '../../lib/errores';
import ConfirmarFecha from '../../components/ConfirmarFecha';
import FormularioSuperior from '../../components/FormularioSuperior';
import { fechaCorta } from '../../lib/fechas';

type Documento = {
  id: number;
  name: string;
  expiry_date: string | null;
  no_expiry: boolean;
  status: 'vigente' | 'proximo' | 'vencido' | 'sin_fecha' | 'sin_vencimiento';
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
  sin_vencimiento: '#2e7d32', // verde: "No vence" es una buena noticia, no una alerta
};

const TEXTO_POR_ESTADO: Record<Documento['status'], string> = {
  vigente: 'Vigente',
  proximo: 'Vence pronto',
  vencido: 'Vencido',
  sin_fecha: 'Sin fecha',
  sin_vencimiento: 'No vence',
};

// Id del usuario al que ya le ofrecimos conectar Google en esta sesión de la app.
// Está fuera del componente para no repetir el aviso cada vez que se cambia de pestaña.
let avisoGoogleParaUsuario: string | null = null;

export default function Docs() {
  const { session } = useAuth();
  const usuarioId = session?.user.id ?? null;
  const { hijos, seleccionadoId, cargando: cargandoHijos, error: errorHijos, cargarHijos } = useChildren();
  const { tema } = useTheme();
  const { mostrarError, mostrarAviso, confirmar } = useAvisos();
  const router = useRouter();
  const hijoSeleccionado = hijos.find((h) => h.id === seleccionadoId);

  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorAmigable | null>(null);
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [archivoElegido, setArchivoElegido] = useState<ArchivoElegido | null>(null);
  const [nombreDocumento, setNombreDocumento] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  // Documento que se está editando (se abre con mantener presionado).
  const [editando, setEditando] = useState<Documento | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  // Documento recién subido que está esperando que el usuario confirme su fecha.
  const [porConfirmar, setPorConfirmar] = useState<{
    docId: number;
    nombre: string;
    fecha: string | null;
  } | null>(null);

  // null = todavía no sabemos (evita el "flash" del botón); true/false = confirmado.
  const [googleConectado, setGoogleConectado] = useState<boolean | null>(null);
  const [conectandoGoogle, setConectandoGoogle] = useState(false);

  const verificarGoogle = useCallback(async () => {
    try {
      const respuesta = await api.get('/auth/google/status');
      setGoogleConectado(Boolean(respuesta.data.conectado));
    } catch {
      // Si falla la consulta (ej. el servidor recién está "despertando" en
      // Render), no rompemos la pantalla: simplemente no mostramos el botón
      // todavía y lo volvemos a intentar la próxima vez que se enfoque Docs.
    }
  }, []);

  const conectarGoogle = async () => {
    setConectandoGoogle(true);
    try {
      const respuesta = await api.get('/auth/google/url');
      const url: string = respuesta.data.url;
      await WebBrowser.openAuthSessionAsync(url, 'docukids://');
      // No confiamos en el resultado del navegador (en desarrollo no siempre
      // vuelve solo a la app): volvemos a preguntarle al backend cómo quedó.
      await verificarGoogle();
    } catch (e) {
      mostrarError(e, { que: 'conectar con Google', onReintentar: conectarGoogle });
    } finally {
      setConectandoGoogle(false);
    }
  };

  // Conexión automática: si la persona todavía no conectó Google, se lo ofrecemos
  // una sola vez apenas entra. Google siempre exige que la persona toque
  // "Permitir" en su propia pantalla; esto solo le ahorra buscar el botón.
  useEffect(() => {
    if (googleConectado !== false || !usuarioId || conectandoGoogle) return;
    if (avisoGoogleParaUsuario === usuarioId) return;
    avisoGoogleParaUsuario = usuarioId;
    confirmar({
      titulo: 'Conectá tu cuenta de Google',
      mensaje:
        'Docukids guarda tus documentos en tu Drive, agenda los turnos en tu Calendar y te avisa por correo cuando algo vence. Para eso necesita tu permiso.\n\nVas a ver una pantalla de Google: tocá "Permitir" y volvé a la app.',
      textoConfirmar: 'Conectar ahora',
      textoCancelar: 'Más tarde',
      icono: 'logo-google',
    }).then((acepto) => {
      if (acepto) conectarGoogle();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConectado, usuarioId, conectandoGoogle]);

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
    } catch (e) {
      setError(interpretarError(e, 'cargar los documentos'));
    } finally {
      setCargando(false);
    }
  }, [seleccionadoId]);

  useFocusEffect(
    useCallback(() => {
      cargarDocumentos();
      verificarGoogle();
    }, [cargarDocumentos, verificarGoogle])
  );

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setArchivoElegido(null);
    setNombreDocumento('');
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      mostrarAviso('Permiso necesario', 'Docukids necesita acceso a tus fotos para subir documentos.', {
        icono: 'images-outline',
        etiquetaAccion: 'Abrir ajustes del teléfono',
        onAccion: () => Linking.openSettings(),
      });
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
      mostrarAviso('Permiso necesario', 'Docukids necesita acceso a la cámara para sacar la foto.', {
        icono: 'camera-outline',
        etiquetaAccion: 'Abrir ajustes del teléfono',
        onAccion: () => Linking.openSettings(),
      });
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
      mostrarAviso('Falta el nombre', 'Escribí un nombre para el documento (ej. "DNI").', { icono: 'create-outline' });
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
      const respuesta = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      const nombreSubido = nombreDocumento.trim();
      cerrarFormulario();
      cargarDocumentos();
      // Pantalla de confirmación de fecha (ver Guía: PATCH /documents/{doc_id}).
      setPorConfirmar({
        docId: respuesta.data.doc_id,
        nombre: nombreSubido,
        fecha: respuesta.data.expiry_date ?? null,
      });
    } catch (e) {
      mostrarError(e, { que: 'subir el documento', onReintentar: subirDocumento });
    } finally {
      setSubiendo(false);
    }
  };

  // Tocar un documento lo abre (Drive o el visor del teléfono).
  const abrirDocumento = async (doc: Documento) => {
    if (!doc.drive_link) {
      mostrarAviso('No se puede abrir', 'Este documento no tiene un enlace a Drive.', { icono: 'link-outline' });
      return;
    }
    try {
      await Linking.openURL(doc.drive_link);
    } catch (e) {
      mostrarError(e, { que: 'abrir el documento', onReintentar: () => abrirDocumento(doc) });
    }
  };

  const abrirEdicion = (doc: Documento) => {
    setEditando(doc);
    setNombreEditado(doc.name);
  };

  const cerrarEdicion = () => {
    if (guardandoEdicion) return;
    setEditando(null);
    setNombreEditado('');
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const nombre = nombreEditado.trim();
    if (!nombre) {
      mostrarAviso('Falta el nombre', 'Escribí un nombre para el documento.', { icono: 'create-outline' });
      return;
    }
    if (nombre === editando.name) {
      cerrarEdicion();
      return;
    }
    setGuardandoEdicion(true);
    try {
      await api.patch(`/documents/${editando.id}`, { name: nombre });
      setGuardandoEdicion(false);
      setEditando(null);
      setNombreEditado('');
      cargarDocumentos();
    } catch (e) {
      setGuardandoEdicion(false);
      mostrarError(e, { que: 'guardar el nombre', onReintentar: guardarEdicion });
    }
  };

  const borrarDocumento = async (doc: Documento) => {
    const seguro = await confirmar({
      titulo: 'Borrar documento',
      mensaje: `¿Seguro que querés borrar "${doc.name}"?`,
      textoConfirmar: 'Borrar',
      peligro: true,
    });
    if (!seguro) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      setEditando(null);
      setNombreEditado('');
      cargarDocumentos();
    } catch (e) {
      mostrarError(e, { que: 'borrar el documento', onReintentar: () => borrarDocumento(doc) });
    }
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
          titulo="Todavía no agregaste a tu hijo"
          mensaje="Registrá a tu hijo para guardar sus documentos en un solo lugar y recibir avisos antes de que venzan."
          etiquetaAccion="Agregar hijo"
          onAccion={() => router.navigate('/hijos')}
        />
      </LinearGradient>
    );
  }

  const esImagen = archivoElegido?.mimeType.startsWith('image/');

  // --- CAMBIO PRINCIPAL: Apertura con LinearGradient ---
  return (
    <LinearGradient colors={tema.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <Text style={styles.subtitulo}>{hijoSeleccionado?.name}</Text>

      {!mostrarFormulario && googleConectado === false && (
        <View style={styles.bloqueGoogle}>
          <TouchableOpacity
            style={[styles.botonGoogle, { backgroundColor: tema.primary }]}
            onPress={conectarGoogle}
            disabled={conectandoGoogle}
          >
            <Text style={styles.botonGoogleTexto}>
              {conectandoGoogle ? 'Conectando...' : 'Conectar con Google'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.ayudaGoogle}>
            Necesario para subir documentos, agendar turnos y recibir avisos por email.
          </Text>
        </View>
      )}

      {!mostrarFormulario && !editando && (
        <TouchableOpacity
          style={[styles.botonSubirGrande, { backgroundColor: tema.primary }]}
          onPress={abrirOpciones}
          activeOpacity={0.85}
        >
          <Text style={styles.botonSubirGrandeTexto}>📂  SUBIR DOCUMENTO</Text>
        </TouchableOpacity>
      )}

      {cargando ? (
        <View style={styles.centroFlex}>
          <EsperaServidor texto="Cargando documentos…" />
        </View>
      ) : error ? (
        <View style={styles.zonaError}>
          <TarjetaError error={error} onReintentar={cargarDocumentos} />
        </View>
      ) : documentos.length === 0 ? (
        <EstadoVacio
          icono="document-text-outline"
          titulo={`${hijoSeleccionado?.name} todavía no tiene documentos`}
          mensaje="Tocá SUBIR DOCUMENTO y elegí una foto o un PDF del DNI, el carnet de vacunas u otro. Si tiene fecha de vencimiento, te avisamos por email antes de que venza."
        />
      ) : (
        <>
          <Text style={styles.ayuda}>Tocá un documento para abrirlo. Mantené presionado para cambiarle el nombre o borrarlo.</Text>
          <FlatList
            data={documentos}
            keyExtractor={(item) => String(item.id)}
            style={styles.listaDocumentos}
            showsVerticalScrollIndicator
            persistentScrollbar
            indicatorStyle="black"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => abrirDocumento(item)}
                onLongPress={() => abrirEdicion(item)}
                activeOpacity={0.7}
                accessibilityHint="Tocá para abrir. Mantené presionado para editar o borrar"
              >
                <View style={[styles.punto, { backgroundColor: COLOR_POR_ESTADO[item.status] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre}>{item.name}</Text>
                  <Text style={styles.estado}>
                    {TEXTO_POR_ESTADO[item.status]}
                    {item.expiry_date ? ` · ${fechaCorta(item.expiry_date)}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {mostrarFormulario && archivoElegido && (
        <FormularioSuperior>
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
            placeholderTextColor="#5F5F5F"
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
              style={[styles.botonForm, styles.botonGuardar, { backgroundColor: tema.primary }]}
              onPress={subirDocumento}
              disabled={subiendo}
            >
              <Text style={styles.botonTexto}>{subiendo ? 'Subiendo...' : 'Subir'}</Text>
            </TouchableOpacity>
          </View>
          {subiendo && (
            <Text style={styles.textoSubiendo}>Subiendo a Drive y leyendo la fecha, puede tardar...</Text>
          )}
        </FormularioSuperior>
      )}

      {editando && (
        <FormularioSuperior onCerrar={guardandoEdicion ? undefined : cerrarEdicion}>
          <Text style={styles.tituloEdicion}>Editar documento</Text>
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder="Nombre del documento"
            value={nombreEditado}
            onChangeText={setNombreEditado}
            autoFocus
          />
          <View style={styles.filaBotones}>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonCancelar]}
              onPress={cerrarEdicion}
              disabled={guardandoEdicion}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar, { backgroundColor: tema.primary }]}
              onPress={guardarEdicion}
              disabled={guardandoEdicion}
            >
              <Text style={styles.botonTexto}>{guardandoEdicion ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.botonEliminar}
            onPress={() => borrarDocumento(editando)}
            disabled={guardandoEdicion}
          >
            <Text style={styles.botonEliminarTexto}>Eliminar documento</Text>
          </TouchableOpacity>
        </FormularioSuperior>
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

      {porConfirmar && (
        <ConfirmarFecha
          visible
          docId={porConfirmar.docId}
          nombreDocumento={porConfirmar.nombre}
          fechaDetectada={porConfirmar.fecha}
          onTerminar={() => {
            setPorConfirmar(null);
            cargarDocumentos();
          }}
        />
      )}
    </LinearGradient> // --- CAMBIO PRINCIPAL: Cierre con LinearGradient ---
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centroFlex: { alignItems: 'center', marginTop: 40, gap: 12 },
  zonaError: { marginTop: 24 },
  subtitulo: { fontSize: 17, color: '#3F3F3F', marginBottom: 12 },
  ayuda: { fontSize: 14, color: '#3F3F3F', marginBottom: 8 },
  vacio: { fontSize: 16, color: '#3F3F3F', marginTop: 20 },
  bloqueGoogle: { alignItems: 'center', marginBottom: 16 },
  botonGoogle: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, alignSelf: 'stretch', alignItems: 'center' },
  botonGoogleTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
  ayudaGoogle: { fontSize: 14, color: '#3F3F3F', textAlign: 'center', marginTop: 6 },
  botonSubirGrande: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  botonSubirGrandeTexto: { color: '#1F1F1F', fontSize: 20, fontWeight: 'bold' },
  listaDocumentos: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  punto: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  nombre: { fontSize: 18, fontWeight: '600' },
  estado: { fontSize: 15, color: '#3F3F3F' },
  botonTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
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
  nombrePDF: { fontSize: 15, color: '#1F1F1F' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#D0D0D0' },
  botonGuardar: { backgroundColor: '#1976d2' },
  tituloEdicion: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#1F1F1F' },
  botonEliminar: { marginTop: 14, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#c62828' },
  botonEliminarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 16 },
  textoSubiendo: { fontSize: 14, color: '#3F3F3F', marginTop: 8, textAlign: 'center' },
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
  menuTitulo: { fontSize: 17, color: '#3F3F3F', marginBottom: 8, textAlign: 'center' },
  menuOpcion: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#eee' },
  menuOpcionTexto: { fontSize: 18, textAlign: 'center', color: '#0D47A1' },
  menuCancelar: { paddingVertical: 14, marginTop: 8 },
  menuCancelarTexto: { fontSize: 18, textAlign: 'center', color: '#c62828', fontWeight: 'bold' },
});