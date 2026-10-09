import { ComponentProps, useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAvisos } from '../context/AvisosContext';
import { ErrorAmigable, TipoError } from '../lib/errores';

export type NombreIcono = ComponentProps<typeof Ionicons>['name'];

// Un ícono por tipo de error. Ninguno es rojo ni de alarma: el color sale del
// tema, para que el aviso se sienta parte de la app y no "algo roto".
export const ICONO_POR_TIPO: Record<TipoError, NombreIcono> = {
  sin_internet: 'cloud-offline-outline',
  servidor_despertando: 'moon-outline',
  sesion_vencida: 'lock-closed-outline',
  google_desconectado: 'logo-google',
  archivo_grande: 'documents-outline',
  archivo_tipo: 'ban-outline',
  archivo_vacio: 'document-outline',
  no_encontrado: 'search-outline',
  datos_invalidos: 'create-outline',
  servidor: 'construct-outline',
  generico: 'alert-circle-outline',
};

// Un aviso listo para mostrar (lo arma AvisosContext).
export type Aviso = {
  id: number;
  titulo: string;
  mensaje: string;
  icono: NombreIcono;
  etiquetaAccion?: string | null;
  onAccion?: () => void;
  duracion?: number;
};

const TEXTO = '#1F1F1F';
const TEXTO_SUAVE = '#3F3F3F';

// El botón de acción solo existe si hay algo que hacer: "Reintentar" sin una
// función para reintentar sería un botón muerto.
export function tieneBoton(error: ErrorAmigable, hayReintento: boolean): boolean {
  if (error.accion === 'reintentar') return hayReintento;
  return error.accion !== null;
}

// Hace "respirar" el ícono mientras hay algo esperando (servidor despertando).
function useLatido(activo: boolean) {
  const valor = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!activo) {
      valor.setValue(1);
      return;
    }
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(valor, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    bucle.start();
    return () => bucle.stop();
  }, [activo, valor]);
  return valor;
}

// ---------------------------------------------------------------------------
// Formato 1: tarjeta que reemplaza al texto plano cuando falla una CARGA.
//   variante "grande"   -> ocupa el centro de la pantalla (listas).
//   variante "compacta" -> una fila chica, para meter dentro de una ventana.
// ---------------------------------------------------------------------------
type PropsTarjeta = {
  error: ErrorAmigable;
  onReintentar?: () => void;
  variante?: 'grande' | 'compacta';
};

export function TarjetaError({ error, onReintentar, variante = 'grande' }: PropsTarjeta) {
  const { tema } = useTheme();
  const { ejecutarAccion } = useAvisos();
  const latido = useLatido(error.tipo === 'servidor_despertando');
  const conBoton = tieneBoton(error, Boolean(onReintentar));
  const icono = ICONO_POR_TIPO[error.tipo];
  const accionar = () => ejecutarAccion(error, onReintentar);

  if (variante === 'compacta') {
    return (
      <View style={[styles.compacta, { borderColor: tema.primary }]} accessibilityRole="alert">
        <FilaAviso
          icono={icono}
          titulo={error.titulo}
          mensaje={error.mensaje}
          etiquetaAccion={conBoton ? error.etiquetaAccion : null}
          onAccion={accionar}
          opacidadIcono={latido}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.grande, { backgroundColor: tema.card, borderColor: tema.primary }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.circuloGrande, { backgroundColor: tema.primary, opacity: latido }]}>
        <Ionicons name={icono} size={38} color={TEXTO} />
      </Animated.View>
      <Text style={styles.tituloGrande}>{error.titulo}</Text>
      <Text style={styles.mensajeGrande}>{error.mensaje}</Text>
      {conBoton && error.etiquetaAccion && (
        <TouchableOpacity
          style={[styles.botonGrande, { backgroundColor: tema.primary, borderColor: tema.primary }]}
          onPress={accionar}
          activeOpacity={0.8}
          accessibilityLabel={error.etiquetaAccion}
        >
          <Text style={styles.textoBotonGrande}>{error.etiquetaAccion}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Fila común: ícono a la izquierda; título, mensaje y botón a la derecha.
function FilaAviso({
  icono,
  titulo,
  mensaje,
  etiquetaAccion,
  onAccion,
  opacidadIcono,
}: {
  icono: NombreIcono;
  titulo: string;
  mensaje: string;
  etiquetaAccion?: string | null;
  onAccion?: () => void;
  opacidadIcono?: Animated.Value;
}) {
  const { tema } = useTheme();
  return (
    <View style={styles.fila}>
      <Animated.View style={[styles.circuloChico, { backgroundColor: tema.primary, opacity: opacidadIcono ?? 1 }]}>
        <Ionicons name={icono} size={24} color={TEXTO} />
      </Animated.View>
      <View style={styles.textos}>
        <Text style={styles.tituloFila}>{titulo}</Text>
        <Text style={styles.mensajeFila}>{mensaje}</Text>
        {etiquetaAccion && onAccion && (
          <TouchableOpacity
            style={[styles.botonChico, { borderColor: tema.primary, backgroundColor: tema.primary }]}
            onPress={onAccion}
            activeOpacity={0.8}
            accessibilityLabel={etiquetaAccion}
          >
            <Text style={styles.textoBotonChico}>{etiquetaAccion}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formato 2: aviso que BAJA desde arriba y se va solo. Reemplaza al Alert
// cuando falla una ACCIÓN (subir, guardar, borrar) o hay que avisar algo corto.
// Tocarlo lo cierra. Lo muestra AvisosContext; las pantallas no lo usan directo.
// ---------------------------------------------------------------------------
const ALTO_FUERA = -200;

export function AvisoFlotante({ aviso, onCerrar }: { aviso: Aviso; onCerrar: () => void }) {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(ALTO_FUERA)).current;
  const opacidad = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);

  const cerrar = useCallback(() => {
    if (cerrando.current) return;
    cerrando.current = true;
    Animated.parallel([
      Animated.timing(y, { toValue: ALTO_FUERA, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onCerrar());
  }, [y, opacidad, onCerrar]);

  // El temporizador usa siempre la última versión de "cerrar".
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const espera = aviso.duracion ?? (aviso.etiquetaAccion ? 8000 : 5000);
    const temporizador = setTimeout(() => cerrarRef.current(), espera);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.capaAviso, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View style={{ transform: [{ translateY: y }], opacity: opacidad }}>
        <Pressable
          onPress={cerrar}
          style={[styles.aviso, { backgroundColor: tema.card, borderColor: tema.primary }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityHint="Tocá para cerrar este aviso"
        >
          <FilaAviso
            icono={aviso.icono}
            titulo={aviso.titulo}
            mensaje={aviso.mensaje}
            etiquetaAccion={aviso.etiquetaAccion}
            onAccion={
              aviso.onAccion
                ? () => {
                    aviso.onAccion?.();
                    cerrar();
                  }
                : undefined
            }
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tarjeta grande
  grande: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginHorizontal: 4,
  },
  circuloGrande: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  tituloGrande: { fontSize: 22, fontWeight: 'bold', color: TEXTO, textAlign: 'center', marginBottom: 8 },
  mensajeGrande: { fontSize: 17, lineHeight: 24, color: TEXTO_SUAVE, textAlign: 'center' },
  botonGrande: { marginTop: 20, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 3 },
  textoBotonGrande: { fontSize: 19, fontWeight: 'bold', color: TEXTO },

  // Fila (aviso flotante y tarjeta compacta)
  compacta: { borderWidth: 2, borderRadius: 14, padding: 12, marginTop: 10 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  circuloChico: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1 },
  tituloFila: { fontSize: 17, fontWeight: 'bold', color: TEXTO },
  mensajeFila: { fontSize: 15, lineHeight: 21, color: TEXTO_SUAVE, marginTop: 2 },
  botonChico: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10, borderWidth: 2 },
  textoBotonChico: { fontSize: 16, fontWeight: 'bold', color: TEXTO },

  // Aviso flotante
  capaAviso: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, zIndex: 1000, elevation: 20 },
  aviso: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 14,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
