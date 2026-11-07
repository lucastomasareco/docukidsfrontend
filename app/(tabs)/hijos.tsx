import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Image,
  Animated,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useChildren, type Hijo } from '../../context/ChildrenContext';
import { useTheme } from '../../context/ThemeContext';
import { useAvisos } from '../../context/AvisosContext';
import { TarjetaError } from '../../components/AvisoError';
import EsperaServidor from '../../components/EsperaServidor';
import EstadoVacio from '../../components/EstadoVacio';
import FormularioSuperior from '../../components/FormularioSuperior';
import TarjetaRecuperarDatos from '../../components/TarjetaRecuperarDatos';
import SelectorAvatar from '../../components/SelectorAvatar';
import AsaArrastre from '../../components/AsaArrastre';
import type { AvatarElegido } from '../../lib/avatar';
import { colorConOpacidad } from '../../lib/fechas';

// Para comparar nombres: sin mayúsculas, sin tildes y sin espacios de más.
// Así "Lucía", "lucia" y "LUC" coinciden al buscar.
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Alto aproximado de una fila (tarjeta + separación) hasta que se mide de verdad,
// y mitad del alto de la tarjeta (el "centro" del hijo que se arrastra).
const ALTURA_ESTIMADA = 78;
const MEDIA_TARJETA = 34;

// Hijo que se está arrastrando. top = dónde está su tarjeta, dentro de la lista, al agarrarlo.
type Arrastre = { hijo: Hijo; top: number };
type Indicador = { id: number; lado: 'antes' | 'despues' };
type Destino = { indice: number; indicador: Indicador };

function inicial(nombre: string): string {
  return nombre.charAt(0).toUpperCase();
}

export default function Hijos() {
  const {
    hijos,
    seleccionadoId,
    cargando,
    error,
    seleccionarHijo,
    cargarHijos,
    agregarHijo,
    editarHijo,
    eliminarHijo,
    colocarOrdenHijos,
    arrastreBloqueado,
    alternarBloqueoArrastre,
  } = useChildren();
  const { tema } = useTheme();
  const { mostrarError, mostrarAviso, confirmar } = useAvisos();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [hijoEditando, setHijoEditando] = useState<Hijo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Foto elegida para el hijo nuevo (issue #36), ya reducida y lista para enviar.
  const [avatarNuevo, setAvatarNuevo] = useState<AvatarElegido | null>(null);
  // Al editar: true si la persona tocó "Quitar" para borrar la foto que ya tenía.
  const [quitarAvatar, setQuitarAvatar] = useState(false);

  // Buscador: muestra los hijos cuyo nombre EMPIEZA con lo escrito (L, Lu, Luc…).
  const textoBuscado = normalizar(busqueda);
  const hijosVisibles = useMemo(
    () => (textoBuscado ? hijos.filter((h) => normalizar(h.name).startsWith(textoBuscado)) : hijos),
    [hijos, textoBuscado]
  );

  // Accesibilidad: un lector de pantalla dice cuántos resultados hay (con una pequeña
  // espera para no hablar encima mientras se escribe).
  useEffect(() => {
    if (!textoBuscado) return;
    const espera = setTimeout(() => {
      const n = hijosVisibles.length;
      AccessibilityInfo.announceForAccessibility(
        n === 0 ? 'No hay hijos con ese nombre' : n === 1 ? '1 hijo encontrado' : `${n} hijos encontrados`
      );
    }, 700);
    return () => clearTimeout(espera);
  }, [textoBuscado, hijosVisibles.length]);

  // --- Arrastre de hijos (mismo mecanismo que los documentos de Docs) ---
  // Con una búsqueda activa la lista está filtrada y "dónde cae" sería ambiguo: no se arrastra.
  const puedeArrastrar = !arrastreBloqueado && !textoBuscado && hijos.length > 1;
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const dragY = useRef(new Animated.Value(0)).current; // cuánto se movió el dedo (mueve el "fantasma")
  const listaRef = useRef<FlatList<Hijo> | null>(null);
  // Copias en "ref" de lo que necesitan los gestos y el temporizador (siempre leen lo último).
  const arrastreRef = useRef<Arrastre | null>(null);
  const destinoRef = useRef<Destino | null>(null);
  const hijosRef = useRef<Hijo[]>(hijos);
  hijosRef.current = hijos;
  const dyRef = useRef(0);
  const offsetRef = useRef(0); // cuánto está desplazada la lista
  const contenidoAltoRef = useRef(0);
  const alturaListaRef = useRef(0);
  const alturasRef = useRef<Record<number, number>>({});
  const temporizadorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoDesplazarRef = useRef<() => void>(() => {});

  const detenerAutoDesplazar = () => {
    if (temporizadorRef.current) {
      clearInterval(temporizadorRef.current);
      temporizadorRef.current = null;
    }
  };
  useEffect(() => detenerAutoDesplazar, []);

  // Dónde caería el hijo arrastrado según la posición actual del dedo.
  const calcularDestino = (): Destino | null => {
    const a = arrastreRef.current;
    if (!a) return null;
    const lista = hijosRef.current;
    let y = 0;
    const posiciones = lista.map((h) => {
      const alto = alturasRef.current[h.id] ?? ALTURA_ESTIMADA;
      const p = { hijo: h, y, alto };
      y += alto;
      return p;
    });
    if (posiciones.length === 0) return null;
    const centro = a.top + dyRef.current + MEDIA_TARJETA + offsetRef.current;
    const bajo =
      centro < 0 ? posiciones[0] : posiciones.find((p) => centro >= p.y && centro < p.y + p.alto) ?? posiciones[posiciones.length - 1];
    if (bajo.hijo.id === a.hijo.id) return null; // sigue sobre sí mismo: no cambia nada
    const sinEste = lista.filter((h) => h.id !== a.hijo.id);
    const pos = sinEste.findIndex((h) => h.id === bajo.hijo.id);
    const antes = centro < bajo.y + bajo.alto / 2;
    return { indice: antes ? pos : pos + 1, indicador: { id: bajo.hijo.id, lado: antes ? 'antes' : 'despues' } };
  };

  const actualizarArrastre = () => {
    const destino = calcularDestino();
    destinoRef.current = destino;
    const nuevo = destino?.indicador ?? null;
    setIndicador((prev) => (prev?.id === nuevo?.id && prev?.lado === nuevo?.lado ? prev : nuevo));
  };

  // Si el dedo está cerca del borde de arriba o de abajo, la lista se desplaza sola.
  autoDesplazarRef.current = () => {
    const a = arrastreRef.current;
    if (!a) return;
    const centro = a.top + dyRef.current + MEDIA_TARJETA;
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
    listaRef.current?.scrollToOffset({ offset: nuevo, animated: false });
    actualizarArrastre();
  };

  const iniciarArrastre = (hijo: Hijo) => {
    let y = 0;
    for (const h of hijosRef.current) {
      if (h.id === hijo.id) break;
      y += alturasRef.current[h.id] ?? ALTURA_ESTIMADA;
    }
    const nuevo: Arrastre = { hijo, top: y - offsetRef.current };
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
    // Orden final: todos los hijos sin el arrastrado, con este en su lugar.
    const ids = hijosRef.current.filter((h) => h.id !== a.hijo.id).map((h) => h.id);
    ids.splice(destino.indice, 0, a.hijo.id);
    colocarOrdenHijos(ids);
  };

  useFocusEffect(
    useCallback(() => {
      cargarHijos();
    }, [cargarHijos])
  );

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setNombreNuevo('');
    setAvatarNuevo(null);
    setQuitarAvatar(false);
    setHijoEditando(null);
  };

  const handleGuardar = async () => {
    if (!nombreNuevo.trim()) {
      mostrarAviso('Falta el nombre', 'Escribí un nombre antes de guardar.', { icono: 'create-outline' });
      return;
    }
    setGuardando(true);
    const { error } = hijoEditando
      ? await editarHijo(
          hijoEditando.id,
          nombreNuevo.trim(),
          // foto nueva → texto · "Quitar" → null · sin tocar → undefined (queda como estaba)
          avatarNuevo ? avatarNuevo.dataUri : quitarAvatar ? null : undefined
        )
      : await agregarHijo(nombreNuevo.trim(), avatarNuevo?.dataUri);
    setGuardando(false);
    if (error) {
      if (hijoEditando && (error as any)?.response?.status === 404) {
        // El perfil ya no existe (se borró desde otro teléfono): reintentar no sirve.
        cerrarFormulario();
        cargarHijos();
        mostrarAviso('Ese perfil ya no existe', 'Se borró desde otro lugar. Actualizamos la lista.', {
          icono: 'search-outline',
        });
        return;
      }
      mostrarError(error, {
        que: hijoEditando ? 'guardar el nombre' : 'registrar al hijo',
        onReintentar: handleGuardar,
      });
      return;
    }
    cerrarFormulario();
  };

  // Mantener presionado un hijo abre el formulario de edición (igual que en
  // Docs y Calendario): ahí se cambia el nombre o se elimina.
  const abrirEdicion = (hijo: Hijo) => {
    setHijoEditando(hijo);
    setAvatarNuevo(null);
    setQuitarAvatar(false);
    setNombreNuevo(hijo.name);
    setMostrarFormulario(true);
  };

  const eliminar = async (hijo: Hijo) => {
    setEliminando(true);
    const { error } = await eliminarHijo(hijo.id);
    setEliminando(false);
    if (error) {
      if ((error as any)?.response?.status === 404) {
        // Ya no existía: se actualiza la lista y listo.
        cerrarFormulario();
        cargarHijos();
        return;
      }
      mostrarError(error, { que: 'borrar el perfil', onReintentar: () => eliminar(hijo) });
      return;
    }
    cerrarFormulario();
    mostrarAviso(`${hijo.name} fue borrado`, 'Ya no aparece en tu lista.', { icono: 'checkmark-circle-outline' });
  };

  const confirmarEliminar = async (hijo: Hijo) => {
    const seguro = await confirmar({
      titulo: `Borrar perfil de ${hijo.name}`,
      mensaje: 'Esto borra también sus documentos y sus turnos guardados. Esta acción no se puede deshacer.',
      textoConfirmar: 'Borrar',
      peligro: true,
    });
    if (seguro) await eliminar(hijo);
  };

  if (cargando && hijos.length === 0) {
    return (
      <View style={styles.centro}>
        <EsperaServidor texto="Cargando tus hijos…" />
      </View>
    );
  }

  if (error) {
    return (
      <LinearGradient
        colors={tema.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { justifyContent: 'center' }]}
      >
        <TarjetaError error={error} onReintentar={cargarHijos} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient 
      colors={tema.backgroundGradient} 
      start={{ x: 0, y: 0 }} 
      end={{ x: 1, y: 1 }} 
      style={styles.container}
    >

      {/* Solo aparece si en tu Drive quedaron carpetas de una cuenta anterior. */}
      {!mostrarFormulario && <TarjetaRecuperarDatos />}

      {!mostrarFormulario && (
        <TouchableOpacity
          style={[styles.botonAgendarGrande, { backgroundColor: tema.primary }]}
          onPress={() => setMostrarFormulario(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.botonAgendarGrandeTexto}>👶  Registrar hijo</Text>
        </TouchableOpacity>
      )}

      {/* Buscador: mismo estilo que los títulos de carpeta de Docs. */}
      {hijos.length > 0 && !mostrarFormulario && (
        <View
          style={[
            styles.buscador,
            { borderColor: tema.primary, backgroundColor: colorConOpacidad(tema.primary, 0.22) },
          ]}
        >
          <Ionicons name="search-outline" size={22} color="#1F1F1F" />
          <TextInput
            style={styles.buscadorInput}
            placeholder="Buscar hijo/a"
            placeholderTextColor="#5F5F5F"
            value={busqueda}
            onChangeText={setBusqueda}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar hijo por nombre"
            accessibilityHint="Escribí las primeras letras del nombre"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity
              onPress={() => setBusqueda('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Borrar búsqueda"
            >
              <Ionicons name="close-circle" size={22} color="#3F3F3F" />
            </TouchableOpacity>
          )}
        </View>
      )}
      {textoBuscado.length > 0 && hijosVisibles.length > 0 && (
        <Text style={styles.resultados}>
          {hijosVisibles.length} de {hijos.length} {hijos.length === 1 ? 'hijo' : 'hijos'}
        </Text>
      )}

      {hijos.length === 0 ? (
        !mostrarFormulario && (
          <EstadoVacio
            icono="people-outline"
            titulo="Todavía no agregaste a ningún hijo"
            mensaje="Tocá Registrar hijo para crear su perfil. Después podés guardar sus documentos y turnos, y agregar a todos los hijos que quieras."
          />
        )
      ) : (
        <>
          {/* Candado: sirve para que, en la PC, un arrastre sin querer no cambie el orden. */}
          {hijos.length > 1 && !mostrarFormulario && (
            <View style={styles.filaOrden}>
              <Text style={styles.textoOrden}>
                {arrastreBloqueado ? 'Orden bloqueado' : textoBuscado ? 'Borrá la búsqueda para ordenar' : 'Para ordenar, arrastrá el ícono ≡'}
              </Text>
              <TouchableOpacity
                style={[styles.botonCandado, arrastreBloqueado && { backgroundColor: colorConOpacidad(tema.primary, 0.35) }]}
                onPress={alternarBloqueoArrastre}
                accessibilityRole="button"
                accessibilityLabel={arrastreBloqueado ? 'Desbloquear el orden de los hijos' : 'Bloquear el orden de los hijos'}
              >
                <Ionicons name={arrastreBloqueado ? 'lock-closed' : 'lock-open-outline'} size={18} color="#1F1F1F" />
                <Text style={styles.botonCandadoTexto}>{arrastreBloqueado ? 'Desbloquear' : 'Bloquear'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View
            style={styles.contenedorLista}
            onLayout={(e) => {
              alturaListaRef.current = e.nativeEvent.layout.height;
            }}
          >
            <FlatList
              ref={listaRef}
              data={hijosVisibles}
              scrollEnabled={!arrastre}
              scrollEventThrottle={16}
              onScroll={(e) => {
                offsetRef.current = e.nativeEvent.contentOffset.y;
                if (arrastreRef.current) actualizarArrastre();
              }}
              onContentSizeChange={(_w, h) => {
                contenidoAltoRef.current = h;
              }}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <EstadoVacio
                  variante="compacta"
                  icono="search-outline"
                  titulo="No encontramos a ningún hijo con ese nombre"
                  mensaje="Revisá cómo lo escribiste: se busca por las primeras letras."
                  etiquetaAccion="Borrar búsqueda"
                  onAccion={() => setBusqueda('')}
                />
              }
              renderItem={({ item }) => {
                const seleccionado = item.id === seleccionadoId;
                const lado = indicador?.id === item.id ? indicador.lado : null;
                return (
                  <View
                    onLayout={(e) => {
                      alturasRef.current[item.id] = Math.round(e.nativeEvent.layout.height);
                    }}
                  >
                    <View style={{ opacity: arrastre?.hijo.id === item.id ? 0.3 : 1 }}>
                      <TouchableOpacity
                        style={[
                          styles.card,
                          seleccionado && { backgroundColor: tema.bar, borderWidth: 1.5, borderColor: tema.primary },
                        ]}
                        onPress={() => seleccionarHijo(item.id)}
                        onLongPress={() => abrirEdicion(item)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.avatar, seleccionado && { backgroundColor: tema.primary }]}>
                          {item.avatar_url ? (
                            <Image source={{ uri: item.avatar_url }} style={styles.avatarImagen} resizeMode="cover" />
                          ) : (
                            <Text style={styles.avatarTexto}>{inicial(item.name)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.nombre}>{item.name}</Text>
                          {item.birth_date && <Text style={styles.fecha}>Nacido: {item.birth_date}</Text>}
                        </View>
                        {seleccionado && <Text style={[styles.check, { color: tema.primary }]}>✓</Text>}
                        {puedeArrastrar && (
                          <AsaArrastre
                            onInicio={() => iniciarArrastre(item)}
                            onMover={moverArrastre}
                            onSoltar={(_dy, cancelado) => terminarArrastre(cancelado)}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                    {lado && (
                      <View
                        style={[
                          styles.lineaDestino,
                          { backgroundColor: tema.primary },
                          lado === 'antes' ? { top: -4 } : { bottom: 3 },
                        ]}
                      />
                    )}
                  </View>
                );
              }}
            />
            {arrastre && (
              <Animated.View
                style={[
                  styles.fantasma,
                  { top: arrastre.top, borderColor: tema.primary, transform: [{ translateY: dragY }] },
                ]}
              >
                <View style={styles.avatar}>
                  {arrastre.hijo.avatar_url ? (
                    <Image source={{ uri: arrastre.hijo.avatar_url }} style={styles.avatarImagen} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarTexto}>{inicial(arrastre.hijo.name)}</Text>
                  )}
                </View>
                <Text style={[styles.nombre, { flex: 1 }]}>{arrastre.hijo.name}</Text>
                <Ionicons name="reorder-three-outline" size={28} color="#3F3F3F" />
              </Animated.View>
            )}
          </View>
        </>
      )}
      {mostrarFormulario && (
        <FormularioSuperior onCerrar={hijoEditando && !guardando && !eliminando ? cerrarFormulario : undefined}>
          <Text style={styles.formularioTitulo}>
            {hijoEditando ? 'Editar hijo' : 'Nuevo hijo'}
          </Text>
          <SelectorAvatar
            nombre={nombreNuevo}
            valor={
              avatarNuevo ??
              (hijoEditando?.avatar_url && !quitarAvatar
                ? { dataUri: hijoEditando.avatar_url, bytes: 0 } // la foto que ya tenía
                : null)
            }
            onCambiar={(avatar) => {
              setAvatarNuevo(avatar);
              // "Quitar" solo importa si el hijo ya tenía una foto guardada.
              setQuitarAvatar(avatar === null && !!hijoEditando?.avatar_url);
            }}
            deshabilitado={guardando || eliminando}
          />
          <TextInput
            placeholderTextColor="#5F5F5F"
            style={styles.input}
            placeholder="Nombre del hijo/a"
            value={nombreNuevo}
            onChangeText={setNombreNuevo}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => { if (!guardando && !eliminando) handleGuardar(); }}
          />
          <View style={styles.filaBotones}>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonCancelar]}
              onPress={cerrarFormulario}
              disabled={guardando || eliminando}
            >
              <Text style={styles.botonTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botonForm, styles.botonGuardar, { backgroundColor: tema.primary }]}
              onPress={handleGuardar}
              disabled={guardando || eliminando}
            >
              <Text style={styles.botonTexto}>{guardando ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>
          </View>
          {hijoEditando && (
            // Zona aparte: separada de "Guardar" para que se entienda que borrar
            // es una acción distinta y que NO hace falta tocar Guardar después.
            <View style={styles.zonaBorrar}>
              <Text style={styles.textoBorrar}>
                ¿Ya no querés tener a {hijoEditando.name} en la app? Se borra en el momento: no hace falta tocar Guardar.
              </Text>
              <TouchableOpacity
                style={styles.botonEliminar}
                onPress={() => confirmarEliminar(hijoEditando)}
                disabled={guardando || eliminando}
                accessibilityLabel={`Borrar perfil de ${hijoEditando.name}`}
              >
                <Text style={styles.botonEliminarTexto}>{eliminando ? 'Borrando...' : `Borrar perfil de ${hijoEditando.name}`}</Text>
              </TouchableOpacity>
            </View>
          )}
        </FormularioSuperior>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 16 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  textoGuiaSuave: { fontSize: 16, color: '#3F3F3F', marginTop: 0, marginBottom: 14 },
  ayuda: { fontSize: 14, color: '#3F3F3F', marginBottom: 8 },
  // Igual que EncabezadoCarpeta de Docs: bajo, con borde y tinte del color del tema.
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  buscadorInput: { flex: 1, fontSize: 16, color: '#1F1F1F', paddingVertical: 8 },
  resultados: { fontSize: 14, color: '#3F3F3F', marginBottom: 8 },
  botonAgendarGrande: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  botonAgendarGrandeTexto: { color: '#1F1F1F', fontSize: 20, fontWeight: 'bold' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  cardSeleccionada: { backgroundColor: '#e3f2fd', borderWidth: 1.5, borderColor: '#1976d2' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#bdbdbd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImagen: { width: 44, height: 44, borderRadius: 22 },
  avatarSeleccionado: { backgroundColor: '#1976d2' },
  avatarTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 20 },
  nombre: { fontSize: 18, fontWeight: '600' },
  fecha: { fontSize: 15, color: '#3F3F3F' },
  check: { marginLeft: 'auto', fontSize: 20, color: '#1976d2', fontWeight: 'bold' },
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 16, color: '#1F1F1F' },
  formularioTitulo: { fontSize: 17, fontWeight: 'bold', marginBottom: 10, color: '#1F1F1F' },
  filaBotones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  botonForm: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  botonCancelar: { backgroundColor: '#D0D0D0' },
  botonGuardar: { backgroundColor: '#1976d2' },
  botonTexto: { color: '#1F1F1F', fontWeight: 'bold', fontSize: 16 },
  filaOrden: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  textoOrden: { flex: 1, fontSize: 14, color: '#3F3F3F' },
  botonCandado: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#E6E6E6' },
  botonCandadoTexto: { fontSize: 14, fontWeight: '600', color: '#1F1F1F' },
  contenedorLista: { flex: 1 },
  // Raya que marca dónde va a caer el hijo arrastrado.
  lineaDestino: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2 },
  // Copia de la tarjeta que sigue al dedo mientras se arrastra.
  fantasma: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  zonaBorrar: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#d0d0d0' },
  textoBorrar: { fontSize: 14, lineHeight: 20, color: '#3F3F3F' },
  botonEliminar: { marginTop: 10, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#c62828' },
  botonEliminarTexto: { color: '#c62828', fontWeight: 'bold', fontSize: 16 },
});