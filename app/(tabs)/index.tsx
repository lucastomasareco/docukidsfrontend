import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient'; // <-- IMPORT AGREGADO
import { Ionicons } from '@expo/vector-icons';
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
import { colorConOpacidad, fechaCorta } from '../../lib/fechas';
import { SUELTO, useCarpetas } from '../../lib/carpetas';
import EncabezadoCarpeta from '../../components/EncabezadoCarpeta';
import SelectorCarpeta from '../../components/SelectorCarpeta';
import AsaArrastre from '../../components/AsaArrastre';

type Documento = {
  id: number;
  name: string;
  expiry_date: string | null;
  no_expiry: boolean;
  status: 'vigente' | 'proximo' | 'vencido' | 'sin_fecha' | 'sin_vencimiento';
  drive_link: string | null;
  folder_id: number | null; // null = suelto, en la raíz "Docukids" ("A la vista")
};

// Lo que se dibuja en la lista: documentos, títulos de carpeta y avisos chicos.
type Fila =
  | { tipo: 'doc'; clave: string; doc: Documento; sangria: boolean }
  | { tipo: 'carpeta'; clave: string; nombre: string; id: string; cantidad: number; abierta: boolean }
  | { tipo: 'vacia'; clave: string; carpetaId: string }
  | { tipo: 'etiqueta'; clave: string; texto: string }
  | { tipo: 'zonaSuelto'; clave: string }; // solo aparece mientras se arrastra, si no hay documentos sueltos

// Documento que se está arrastrando. top = dónde está su tarjeta en la pantalla (de la lista) al agarrarlo.
type Arrastre = { doc: Documento; clave: string; top: number };
// Dónde se marca que va a caer: antes/después de un documento, o "dentro" de una carpeta/zona.
type Indicador = { clave: string; lado: 'antes' | 'despues' | 'dentro' };
type Destino = { carpetaId: string; indice: number; indicador: Indicador };

// Mitad del alto de una tarjeta de documento: el "centro" del documento arrastrado.
const MEDIA_CARTA = 36;

// null = sin formulario de carpeta; 'nueva' = crear; con un id = renombrar esa carpeta.
type FormCarpeta = { modo: 'nueva' } | { modo: 'editar'; id: string };

type ArchivoElegido = {
  uri: string;
  mimeType: string;
  nombreArchivo: string;
};

// Alto estimado de una tarjeta (con su margen) hasta que se mide de verdad.
const ALTURA_ESTIMADA = 82;

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

  // Efecto "carrusel": las tarjetas se desvanecen al acercarse a los bordes de la lista
  // (igual que en Calendario).
  const scrollY = useRef(new Animated.Value(0)).current;
  const [alturaLista, setAlturaLista] = useState(0);
  const [alturas, setAlturas] = useState<Record<string, number>>({});

  // Carpetas: vienen del backend (y se crean también en Drive). Solo el orden queda en el teléfono.
  const {
    carpetas,
    cargando: cargandoCarpetas,
    error: errorCarpetas,
    recargar: recargarCarpetas,
    carpetaDe,
    carpetaPorDefecto,
    olvidarOrden,
    colocarOrden,
    ordenar,
    crearCarpeta,
    renombrarCarpeta,
    eliminarCarpeta,
    existeNombre,
  } = useCarpetas(usuarioId);
  const [cerradas, setCerradas] = useState<Record<string, boolean>>({}); // por defecto todas abiertas
  const [carpetaDestino, setCarpetaDestino] = useState<string>(SUELTO); // al subir
  const [carpetaEdicion, setCarpetaEdicion] = useState<string>(SUELTO); // al editar
  const [formCarpeta, setFormCarpeta] = useState<FormCarpeta | null>(null);
  const [nombreCarpeta, setNombreCarpeta] = useState('');
  const [guardandoCarpeta, setGuardandoCarpeta] = useState(false);

  // --- Arrastre de documentos ---
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const dragY = useRef(new Animated.Value(0)).current; // cuánto se movió el dedo (mueve el "fantasma")
  const listaRef = useRef<any>(null);
  // Copias en "ref" de lo que necesitan los gestos y el temporizador (así siempre leen lo último).
  const arrastreRef = useRef<Arrastre | null>(null);
  const destinoRef = useRef<Destino | null>(null);
  const dyRef = useRef(0);
  const offsetRef = useRef(0); // cuánto está desplazada la lista
  const contenidoAltoRef = useRef(0);
  const alturaListaRef = useRef(0);
  const alturasRef = useRef<Record<string, number>>({});
  const temporizadorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoDesplazarRef = useRef<() => void>(() => {});

  const detenerAutoDesplazar = () => {
    if (temporizadorRef.current) {
      clearInterval(temporizadorRef.current);
      temporizadorRef.current = null;
    }
  };
  useEffect(() => detenerAutoDesplazar, []);

  // Documentos de cada grupo (sueltos y cada carpeta), en el orden que eligió la persona.
  const grupos = useMemo(() => {
    const g: Record<string, Documento[]> = {};
    g[SUELTO] = ordenar(documentos.filter((d) => carpetaDe(d.folder_id) === SUELTO), SUELTO);
    carpetas.forEach((c) => {
      g[c.id] = ordenar(documentos.filter((d) => carpetaDe(d.folder_id) === c.id), c.id);
    });
    return g;
  }, [documentos, carpetas, carpetaDe, ordenar]);

  // Orden de la lista: primero los documentos sueltos (siempre a la vista) y después
  // cada carpeta con su título y, si está abierta, sus documentos.
  const filas: Fila[] = useMemo(() => {
    const lista: Fila[] = [];
    const sueltos = grupos[SUELTO] ?? [];
    if (sueltos.length > 0) {
      lista.push({ tipo: 'etiqueta', clave: 'etiqueta-sueltos', texto: 'A la vista' });
      sueltos.forEach((d) => lista.push({ tipo: 'doc', clave: `d${d.id}`, doc: d, sangria: false }));
    } else if (arrastre) {
      // Para poder dejar un documento suelto aunque todavía no haya ninguno.
      lista.push({ tipo: 'zonaSuelto', clave: 'zona-suelto' });
    }
    carpetas.forEach((c) => {
      const docs = grupos[c.id] ?? [];
      const abierta = !cerradas[c.id];
      lista.push({ tipo: 'carpeta', clave: `c-${c.id}`, id: c.id, nombre: c.nombre, cantidad: docs.length, abierta });
      if (!abierta) return;
      if (docs.length === 0) lista.push({ tipo: 'vacia', clave: `v-${c.id}`, carpetaId: c.id });
      else docs.forEach((d) => lista.push({ tipo: 'doc', clave: `d${d.id}`, doc: d, sangria: true }));
    });
    return lista;
  }, [grupos, carpetas, cerradas, arrastre]);

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

  // --- SOLO PC: arrastrar un archivo a la ventana (respaldo si el explorador de Windows no se abre) ---
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);

  // Con una ventana de formulario ya abierta (editar, carpeta) no se acepta un archivo nuevo.
  const bloqueadoParaSoltar = !!editando || !!formCarpeta || !!porConfirmar;

  const recibirArchivoSoltado = useCallback(
    (lista: FileList | null | undefined) => {
      const archivos = lista ? Array.from(lista) : [];
      if (archivos.length === 0) return;
      if (bloqueadoParaSoltar) {
        mostrarAviso('Terminá lo que estás haciendo', 'Cerrá la ventana que tenés abierta y volvé a soltar el archivo.', {
          icono: 'alert-circle-outline',
        });
        return;
      }
      if (archivos.length > 1) {
        mostrarAviso('Un documento por vez', 'Soltá un solo archivo. Después podés subir el siguiente.', {
          icono: 'documents-outline',
        });
        return;
      }
      const archivo = archivos[0];
      // Algunos archivos de Windows llegan sin tipo: lo deducimos por la extensión.
      const ext = (archivo.name.split('.').pop() || '').toLowerCase();
      const porExtension: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      const tipo = archivo.type || porExtension[ext] || '';
      if (tipo !== 'application/pdf' && !tipo.startsWith('image/')) {
        mostrarAviso('Ese archivo no se puede subir', 'Elegí un PDF o una foto (JPG o PNG).', {
          icono: 'document-outline',
        });
        return;
      }
      setMostrarMenu(false);
      setArchivoElegido({
        uri: URL.createObjectURL(archivo),
        mimeType: tipo,
        nombreArchivo: archivo.name,
      });
      setMostrarFormulario(true);
    },
    [bloqueadoParaSoltar, mostrarAviso]
  );

  // Solo mientras esta pestaña está a la vista (si no, soltar un archivo en otra pestaña abriría el formulario acá).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || typeof window === 'undefined' || !seleccionadoId) return;
      const traeArchivos = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
      let adentro = 0; // dragenter/dragleave se disparan también por los elementos hijos: se cuentan.
      const alEntrar = (e: DragEvent) => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        adentro += 1;
        setArrastrandoArchivo(true);
      };
      const alPasar = (e: DragEvent) => {
        if (!traeArchivos(e)) return;
        e.preventDefault(); // sin esto el navegador no deja soltar (y Electron abriría el archivo)
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      };
      const alSalir = (e: DragEvent) => {
        if (!traeArchivos(e)) return;
        adentro = Math.max(0, adentro - 1);
        if (adentro === 0) setArrastrandoArchivo(false);
      };
      const alSoltar = (e: DragEvent) => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        adentro = 0;
        setArrastrandoArchivo(false);
        recibirArchivoSoltado(e.dataTransfer?.files);
      };
      window.addEventListener('dragenter', alEntrar);
      window.addEventListener('dragover', alPasar);
      window.addEventListener('dragleave', alSalir);
      window.addEventListener('drop', alSoltar);
      return () => {
        window.removeEventListener('dragenter', alEntrar);
        window.removeEventListener('dragover', alPasar);
        window.removeEventListener('dragleave', alSalir);
        window.removeEventListener('drop', alSoltar);
        setArrastrandoArchivo(false);
      };
    }, [seleccionadoId, recibirArchivoSoltado])
  );

  const abrirOpciones = () => {
    setCarpetaDestino(carpetaPorDefecto);
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
    setSubiendo(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        // En el navegador el truco { uri, name, type } no sirve (mandaría el texto
        // "[object Object]" en vez del archivo y el backend responde 422).
        // Hay que bajar el archivo elegido y mandarlo como un File de verdad.
        const bajada = await fetch(archivoElegido.uri);
        const blob = await bajada.blob();
        const archivo = new File([blob], archivoElegido.nombreArchivo, { type: archivoElegido.mimeType });
        formData.append('file', archivo);
      } else {
        formData.append('file', {
          uri: archivoElegido.uri,
          name: archivoElegido.nombreArchivo,
          type: archivoElegido.mimeType,
        } as any);
      }
      formData.append('child_id', String(seleccionadoId));
      formData.append('name', nombreDocumento.trim());
      // Sin folder_id el backend lo deja suelto, en la raíz "Docukids".
      if (carpetaDestino !== SUELTO) formData.append('folder_id', carpetaDestino);

      // En web NO se fija el Content-Type a mano: el navegador lo arma solo
      // (con el "boundary" que necesita el multipart).
      const respuesta = await api.post('/upload', formData, {
        headers: Platform.OS === 'web' ? undefined : { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      const nombreSubido = nombreDocumento.trim();
      // Se abre la carpeta para que se vea el documento nuevo (ya quedó dentro de ella en Drive).
      if (carpetaDestino !== SUELTO) setCerradas((prev) => ({ ...prev, [carpetaDestino]: false }));
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
    setCarpetaEdicion(carpetaDe(doc.folder_id));
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
    // Un solo PATCH con lo que cambió: nombre y/o carpeta (el backend mueve el archivo en Drive).
    const cambios: { name?: string; folder_id?: number | null } = {};
    if (nombre !== editando.name) cambios.name = nombre;
    const cambiaCarpeta = carpetaEdicion !== carpetaDe(editando.folder_id);
    if (cambiaCarpeta) cambios.folder_id = carpetaEdicion === SUELTO ? null : Number(carpetaEdicion);
    if (Object.keys(cambios).length === 0) {
      cerrarEdicion();
      return;
    }
    setGuardandoEdicion(true);
    try {
      await api.patch(`/documents/${editando.id}`, cambios);
      if (cambiaCarpeta) {
        olvidarOrden(editando.id);
        if (carpetaEdicion !== SUELTO) setCerradas((prev) => ({ ...prev, [carpetaEdicion]: false }));
      }
      setGuardandoEdicion(false);
      setEditando(null);
      setNombreEditado('');
      cargarDocumentos();
    } catch (e) {
      setGuardandoEdicion(false);
      mostrarError(e, { que: 'guardar los cambios', onReintentar: guardarEdicion });
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

  // Dónde caería el documento arrastrado según la posición actual del dedo.
  const calcularDestino = (): Destino | null => {
    const a = arrastreRef.current;
    if (!a) return null;
    let y = 0;
    const posiciones = filas.map((fila) => {
      const h = alturasRef.current[fila.clave] ?? ALTURA_ESTIMADA;
      const p = { fila, y, h };
      y += h;
      return p;
    });
    if (posiciones.length === 0) return null;

    // Centro del documento arrastrado, medido sobre todo el contenido de la lista.
    const centro = a.top + dyRef.current + MEDIA_CARTA + offsetRef.current;
    const bajo =
      centro < 0 ? posiciones[0] : posiciones.find((p) => centro >= p.y && centro < p.y + p.h) ?? posiciones[posiciones.length - 1];
    const fila = bajo.fila;

    if (fila.tipo === 'doc') {
      if (fila.doc.id === a.doc.id) return null; // sigue sobre sí mismo: no cambia nada
      const carpetaId = carpetaDe(fila.doc.folder_id);
      const grupo = (grupos[carpetaId] ?? []).filter((d) => d.id !== a.doc.id);
      const pos = grupo.findIndex((d) => d.id === fila.doc.id);
      const antes = centro < bajo.y + bajo.h / 2;
      return { carpetaId, indice: antes ? pos : pos + 1, indicador: { clave: fila.clave, lado: antes ? 'antes' : 'despues' } };
    }
    if (fila.tipo === 'carpeta') return { carpetaId: fila.id, indice: 0, indicador: { clave: fila.clave, lado: 'dentro' } };
    if (fila.tipo === 'vacia') return { carpetaId: fila.carpetaId, indice: 0, indicador: { clave: fila.clave, lado: 'dentro' } };
    // Rótulo "A la vista" o zona de soltar: queda suelto, al principio.
    return { carpetaId: SUELTO, indice: 0, indicador: { clave: fila.clave, lado: 'dentro' } };
  };

  const actualizarArrastre = () => {
    const destino = calcularDestino();
    destinoRef.current = destino;
    const nuevo = destino?.indicador ?? null;
    setIndicador((prev) => (prev?.clave === nuevo?.clave && prev?.lado === nuevo?.lado ? prev : nuevo));
  };

  // Si el dedo está cerca del borde de arriba o de abajo, la lista se desplaza sola.
  autoDesplazarRef.current = () => {
    const a = arrastreRef.current;
    if (!a) return;
    const centro = a.top + dyRef.current + MEDIA_CARTA; // posición en la pantalla de la lista
    const alto = alturaListaRef.current;
    const margen = 70;
    let paso = 0;
    if (centro < margen) paso = -Math.ceil((margen - centro) / 6);
    else if (centro > alto - margen) paso = Math.ceil((centro - (alto - margen)) / 6);
    if (paso === 0) return;
    const maximo = Math.max(0, contenidoAltoRef.current - alto);
    const nuevo = Math.min(maximo, Math.max(0, offsetRef.current + paso));
    if (nuevo === offsetRef.current) return;
    offsetRef.current = nuevo;
    listaRef.current?.scrollToOffset?.({ offset: nuevo, animated: false });
    actualizarArrastre();
  };

  const iniciarArrastre = (doc: Documento, clave: string) => {
    let y = 0;
    for (const fila of filas) {
      if (fila.clave === clave) break;
      y += alturasRef.current[fila.clave] ?? ALTURA_ESTIMADA;
    }
    const nuevo: Arrastre = { doc, clave, top: y - offsetRef.current };
    dyRef.current = 0;
    dragY.setValue(0);
    arrastreRef.current = nuevo;
    destinoRef.current = null;
    setArrastre(nuevo);
    detenerAutoDesplazar();
    temporizadorRef.current = setInterval(() => autoDesplazarRef.current(), 16);
  };

  const moverArrastre = (dy: number) => {
    dyRef.current = dy;
    dragY.setValue(dy);
    actualizarArrastre();
  };

  const terminarArrastre = (cancelado: boolean) => {
    detenerAutoDesplazar();
    const a = arrastreRef.current;
    const destino = destinoRef.current;
    arrastreRef.current = null;
    destinoRef.current = null;
    setArrastre(null);
    setIndicador(null);
    dragY.setValue(0);
    if (!a || cancelado || !destino) return;
    // Orden final de la carpeta de destino: sus documentos sin el arrastrado, con este en su lugar.
    const ids = (grupos[destino.carpetaId] ?? []).filter((d) => d.id !== a.doc.id).map((d) => d.id);
    ids.splice(destino.indice, 0, a.doc.id);
    colocarOrden(a.doc.id, destino.carpetaId, ids);
    if (destino.carpetaId !== SUELTO) setCerradas((prev) => ({ ...prev, [destino.carpetaId]: false }));
    // Si cambió de carpeta, también se mueve en el servidor (y en Drive).
    if (carpetaDe(a.doc.folder_id) !== destino.carpetaId) moverEnServidor(a.doc, destino.carpetaId);
  };

  // Mueve un documento a otra carpeta. Se ve al instante y, si el servidor falla, vuelve a donde estaba.
  const moverEnServidor = async (doc: Documento, carpetaId: string) => {
    const nuevo = carpetaId === SUELTO ? null : Number(carpetaId);
    const cambiarEnLista = (folderId: number | null) =>
      setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, folder_id: folderId } : d)));
    cambiarEnLista(nuevo);
    try {
      await api.patch(`/documents/${doc.id}`, { folder_id: nuevo });
    } catch (e) {
      cambiarEnLista(doc.folder_id);
      mostrarError(e, { que: 'mover el documento', onReintentar: () => moverEnServidor(doc, carpetaId) });
    }
  };

  const alternarCarpeta = (id: string) => setCerradas((prev) => ({ ...prev, [id]: !prev[id] }));

  const abrirNuevaCarpeta = () => {
    setFormCarpeta({ modo: 'nueva' });
    setNombreCarpeta('');
  };

  const abrirEdicionCarpeta = (id: string, nombre: string) => {
    setFormCarpeta({ modo: 'editar', id });
    setNombreCarpeta(nombre);
  };

  const cerrarFormCarpeta = () => {
    setFormCarpeta(null);
    setNombreCarpeta('');
  };

  const guardarCarpeta = async () => {
    if (!formCarpeta || guardandoCarpeta) return;
    const nombre = nombreCarpeta.trim();
    if (!nombre) {
      mostrarAviso('Falta el nombre', 'Escribí un nombre para la carpeta (ej. \"Vacunas\").', { icono: 'create-outline' });
      return;
    }
    if (existeNombre(nombre, formCarpeta.modo === 'editar' ? formCarpeta.id : undefined)) {
      mostrarAviso('Esa carpeta ya existe', 'Elegí otro nombre para no confundirte.', { icono: 'folder-outline' });
      return;
    }
    setGuardandoCarpeta(true);
    try {
      if (formCarpeta.modo === 'nueva') await crearCarpeta(nombre);
      else await renombrarCarpeta(formCarpeta.id, nombre);
      cerrarFormCarpeta();
    } catch (e) {
      mostrarError(e, {
        que: formCarpeta.modo === 'nueva' ? 'crear la carpeta' : 'renombrar la carpeta',
        onReintentar: guardarCarpeta,
      });
    } finally {
      setGuardandoCarpeta(false);
    }
  };

  const borrarCarpeta = async () => {
    if (!formCarpeta || formCarpeta.modo !== 'editar' || guardandoCarpeta) return;
    const carpeta = carpetas.find((c) => c.id === formCarpeta.id);
    if (!carpeta) return;
    const seguro = await confirmar({
      titulo: 'Eliminar carpeta',
      mensaje: `¿Eliminar la carpeta "${carpeta.nombre}"? Sus documentos NO se borran: pasan a "A la vista" (fuera de las carpetas, también en tu Drive).`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!seguro) return;
    setGuardandoCarpeta(true);
    try {
      await eliminarCarpeta(carpeta.id);
      cerrarFormCarpeta();
      cargarDocumentos(); // los documentos de esa carpeta ahora vienen con folder_id = null
    } catch (e) {
      mostrarError(e, { que: 'eliminar la carpeta', onReintentar: borrarCarpeta });
    } finally {
      setGuardandoCarpeta(false);
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
            {Platform.OS === 'web' && arrastrandoArchivo && (
        <View pointerEvents="none" style={[styles.capaSoltar, { borderColor: tema.primary }]}>
          <Text style={styles.capaSoltarTexto}>📄 Soltá el archivo acá para subirlo</Text>
        </View>
      )}
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

      {!mostrarFormulario && !editando && !formCarpeta && (
        <>
          <TouchableOpacity
            style={[styles.botonSubirGrande, { backgroundColor: tema.primary }]}
            onPress={abrirOpciones}
            activeOpacity={0.85}
          >
            <Text style={styles.botonSubirGrandeTexto}>📂  SUBIR DOCUMENTO</Text>
          </TouchableOpacity>
          {/* Más chico y solo con borde: es para ordenar, no para subir. */}
          <TouchableOpacity
            style={[styles.botonNuevaCarpeta, { borderColor: tema.primary }]}
            onPress={abrirNuevaCarpeta}
            activeOpacity={0.7}
            accessibilityLabel="Crear una carpeta nueva"
          >
            <Ionicons name="folder-outline" size={18} color="#1F1F1F" />
            <Text style={styles.botonNuevaCarpetaTexto}>Nueva carpeta</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <Text style={styles.ayudaArrastrar}>
              ¿No se abre el explorador de archivos? Arrastrá un PDF o una foto desde tu carpeta y soltalo en esta ventana.
            </Text>
          )}
        </>
      )}

      {cargando || (cargandoCarpetas && carpetas.length === 0) ? (
        <View style={styles.centroFlex}>
          <EsperaServidor texto="Cargando documentos…" />
        </View>
      ) : error || errorCarpetas ? (
        <View style={styles.zonaError}>
          <TarjetaError
            error={(error ?? errorCarpetas)!}
            onReintentar={() => {
              if (errorCarpetas) recargarCarpetas();
              if (error) cargarDocumentos();
            }}
          />
        </View>
      ) : documentos.length === 0 ? (
        <EstadoVacio
          icono="document-text-outline"
          titulo={`${hijoSeleccionado?.name} todavía no tiene documentos`}
          mensaje="Tocá SUBIR DOCUMENTO y elegí una foto o un PDF del DNI, el carnet de vacunas u otro. Si tiene fecha de vencimiento, te avisamos por email antes de que venza."
        />
      ) : (
        <>
          <Text style={styles.ayuda}>Tocá un documento para abrirlo. Mantené presionado para renombrarlo o borrarlo. Para moverlo, arrastrá el ícono ≡.</Text>
          <View style={styles.listaDocumentos} onLayout={(e) => {
              alturaListaRef.current = e.nativeEvent.layout.height;
              setAlturaLista(e.nativeEvent.layout.height);
            }}>
            <Animated.FlatList
              ref={listaRef}
              data={filas}
              scrollEnabled={!arrastre}
              onContentSizeChange={(_w: number, h: number) => {
                contenidoAltoRef.current = h;
              }}
              keyExtractor={(item: Fila) => item.clave}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                useNativeDriver: true,
                listener: (e: any) => {
                  offsetRef.current = e.nativeEvent.contentOffset.y;
                  if (arrastreRef.current) actualizarArrastre();
                },
              })}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item, index }: { item: Fila; index: number }) => {
                // Posición de la tarjeta dentro de la lista (suma de las alturas de las anteriores).
                const viewport = alturaLista || 400;
                const h = Math.min(alturas[item.clave] ?? ALTURA_ESTIMADA, viewport);
                let y = 0;
                for (let j = 0; j < index; j++) y += alturas[filas[j].clave] ?? ALTURA_ESTIMADA;
                const zona = h * 0.8; // tramo en el que se va volviendo transparente
                // scrollY -> [invisible abajo, visible, visible, invisible arriba]
                const entrada = [y + h - viewport - zona, y + h - viewport, y, y + zona];
                const opacity = scrollY.interpolate({
                  inputRange: entrada,
                  outputRange: [0, 1, 1, 0],
                  extrapolate: 'clamp',
                });
                const scale = scrollY.interpolate({
                  inputRange: entrada,
                  outputRange: [0.92, 1, 1, 0.92],
                  extrapolate: 'clamp',
                });

                const lado = indicador?.clave === item.clave ? indicador.lado : null;

                return (
                  <Animated.View
                    style={{ opacity, transform: [{ scale }] }}
                    onLayout={(e) => {
                      const alto = Math.round(e.nativeEvent.layout.height);
                      alturasRef.current[item.clave] = alto;
                      setAlturas((prev) => (prev[item.clave] === alto ? prev : { ...prev, [item.clave]: alto }));
                    }}
                  >
                    <View style={{ opacity: arrastre?.clave === item.clave ? 0.3 : 1 }}>
                      {item.tipo === 'etiqueta' ? (
                        <Text style={[styles.etiquetaSeccion, lado === 'dentro' && styles.etiquetaResaltada]}>{item.texto}</Text>
                      ) : item.tipo === 'zonaSuelto' ? (
                        <View
                          style={[
                            styles.zonaSuelto,
                            { borderColor: tema.primary },
                            lado === 'dentro' && { backgroundColor: colorConOpacidad(tema.primary, 0.45) },
                          ]}
                        >
                          <Text style={styles.zonaSueltoTexto}>Soltá acá para dejarlo a la vista</Text>
                        </View>
                      ) : item.tipo === 'carpeta' ? (
                        <EncabezadoCarpeta
                          nombre={item.nombre}
                          cantidad={item.cantidad}
                          abierta={item.abierta}
                          resaltada={lado === 'dentro'}
                          onPress={() => alternarCarpeta(item.id)}
                          onLongPress={() => abrirEdicionCarpeta(item.id, item.nombre)}
                        />
                      ) : item.tipo === 'vacia' ? (
                        <Text style={[styles.carpetaVacia, lado === 'dentro' && styles.vaciaResaltada]}>
                          {lado === 'dentro' ? 'Soltá acá' : 'Carpeta vacía'}
                        </Text>
                      ) : (
                        <TouchableOpacity
                          style={[styles.card, item.sangria && styles.cardEnCarpeta]}
                          onPress={() => abrirDocumento(item.doc)}
                          onLongPress={() => abrirEdicion(item.doc)}
                          activeOpacity={0.7}
                          accessibilityHint="Tocá para abrir. Mantené presionado para editar, mover o borrar"
                        >
                          <View style={[styles.punto, { backgroundColor: COLOR_POR_ESTADO[item.doc.status] }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.nombre}>{item.doc.name}</Text>
                            <Text style={styles.estado}>
                              {TEXTO_POR_ESTADO[item.doc.status]}
                              {item.doc.expiry_date ? ` · ${fechaCorta(item.doc.expiry_date)}` : ''}
                            </Text>
                          </View>
                          <AsaArrastre
                            onInicio={() => iniciarArrastre(item.doc, item.clave)}
                            onMover={moverArrastre}
                            onSoltar={(_dy, cancelado) => terminarArrastre(cancelado)}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    {/* Línea que marca dónde va a quedar el documento arrastrado. */}
                    {item.tipo === 'doc' && (lado === 'antes' || lado === 'despues') && (
                      <View
                        style={[
                          styles.lineaDestino,
                          { backgroundColor: tema.primary },
                          lado === 'antes' ? { top: -4 } : { bottom: 3 },
                          item.sangria && { left: 14 },
                        ]}
                      />
                    )}
                  </Animated.View>
                );
              }}
            />
            {/* "Fantasma": copia del documento que sigue al dedo mientras se arrastra. */}
            {arrastre && (
              <Animated.View
                style={[
                  styles.fantasma,
                  { top: arrastre.top, borderColor: tema.primary, transform: [{ translateY: dragY }] },
                ]}
              >
                <View style={[styles.punto, { backgroundColor: COLOR_POR_ESTADO[arrastre.doc.status] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre}>{arrastre.doc.name}</Text>
                  <Text style={styles.estado}>
                    {TEXTO_POR_ESTADO[arrastre.doc.status]}
                    {arrastre.doc.expiry_date ? ` · ${fechaCorta(arrastre.doc.expiry_date)}` : ''}
                  </Text>
                </View>
                <Ionicons name="reorder-three-outline" size={28} color="#3F3F3F" />
              </Animated.View>
            )}
          </View>
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
          <SelectorCarpeta
            etiqueta="¿Dónde lo guardo?"
            carpetas={carpetas}
            valor={carpetaDestino}
            onCambiar={setCarpetaDestino}
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
          <SelectorCarpeta
            etiqueta="Carpeta"
            carpetas={carpetas}
            valor={carpetaEdicion}
            onCambiar={setCarpetaEdicion}
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

      {formCarpeta && (
        <FormularioSuperior onCerrar={guardandoCarpeta ? undefined : cerrarFormCarpeta}>
          <Text style={styles.tituloEdicion}>{formCarpeta.modo === 'nueva' ? 'Nueva carpeta' : 'Editar carpeta'}</Text>
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder='Nombre de la carpeta (ej. "Vacunas")'
            value={nombreCarpeta}
            onChangeText={setNombreCarpeta}
            maxLength={30}
            autoFocus
          />
          <View style={styles.filaBotones}>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonCancelar]}
              onPress={cerrarFormCarpeta}
              disabled={guardandoCarpeta}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar, { backgroundColor: tema.primary }]}
              onPress={guardarCarpeta}
              disabled={guardandoCarpeta}
            >
              <Text style={styles.botonTexto}>
                {guardandoCarpeta ? 'Guardando...' : formCarpeta.modo === 'nueva' ? 'Crear' : 'Guardar'}
              </Text>
            </TouchableOpacity>
          </View>
          {formCarpeta.modo === 'editar' && !carpetas.find((c) => c.id === formCarpeta.id)?.fija && (
            <TouchableOpacity style={styles.botonEliminar} onPress={borrarCarpeta} disabled={guardandoCarpeta}>
              <Text style={styles.botonEliminarTexto}>Eliminar carpeta</Text>
            </TouchableOpacity>
          )}
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
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  botonSubirGrandeTexto: { color: '#1F1F1F', fontSize: 20, fontWeight: 'bold' },
  // Más bajo y con solo borde: se distingue del botón grande SUBIR DOCUMENTO.
  botonNuevaCarpeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  botonNuevaCarpetaTexto: { fontSize: 15, fontWeight: '600', color: '#1F1F1F' },
  ayudaArrastrar: { fontSize: 13, color: '#3F3F3F', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  capaSoltar: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 50,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capaSoltarTexto: { fontSize: 20, fontWeight: '700', color: '#1F1F1F', textAlign: 'center', paddingHorizontal: 24 },
  etiquetaSeccion: { fontSize: 13, fontWeight: 'bold', color: '#3F3F3F', marginTop: 4, marginBottom: 6, textTransform: 'uppercase' },
  carpetaVacia: { fontSize: 14, color: '#3F3F3F', fontStyle: 'italic', marginLeft: 14, marginBottom: 10 },
  cardEnCarpeta: { marginLeft: 14 },
  etiquetaResaltada: { color: '#1F1F1F', textDecorationLine: 'underline' },
  vaciaResaltada: { fontWeight: 'bold', fontStyle: 'normal', color: '#1F1F1F' },
  zonaSuelto: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  zonaSueltoTexto: { fontSize: 14, fontWeight: '600', color: '#3F3F3F' },
  lineaDestino: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  fantasma: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    pointerEvents: 'none',
  },
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