import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { NombreIcono } from './AvisoError';

const TEXTO = '#1F1F1F';
const ROJO = '#c62828';
const ANCHO_MENU = 220;

export type AccionMenu = {
  etiqueta: string;
  icono: NombreIcono;
  onPress: () => void;
  peligro?: boolean;
};

type Props = {
  acciones: AccionMenu[];
  etiquetaAccesible: string; // ej. "Acciones de DNI"
  bloqueado?: boolean;
};

// Botón ⋮ que abre un menú con acciones. Funciona con clic (escritorio) y toque (celular).
export default function MenuAcciones({ acciones, etiquetaAccesible, bloqueado = false }: Props) {
  const { tema } = useTheme();
  const { width: ancho } = useWindowDimensions();
  const botonRef = useRef<View>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const abrir = () => {
    botonRef.current?.measureInWindow((x, y, w, h) => {
      setPos({ x, y, w, h });
      setAbierto(true);
    });
  };

  const elegir = (accion: AccionMenu) => {
    setAbierto(false);
    // Se espera a que el menú se cierre antes de abrir cartelitos o formularios.
    setTimeout(accion.onPress, 0);
  };

  // El menú se alinea al borde derecho del botón y nunca se sale de la pantalla.
  const izquierda = Math.max(8, Math.min(pos.x + pos.w - ANCHO_MENU, ancho - ANCHO_MENU - 8));

  return (
    <>
      <View ref={botonRef} collapsable={false}>
        <TouchableOpacity
          onPress={abrir}
          disabled={bloqueado}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
          style={styles.boton}
          accessibilityRole="button"
          accessibilityLabel={etiquetaAccesible}
          accessibilityHint="Abre un menú con acciones"
        >
          <Ionicons name="ellipsis-vertical" size={22} color={TEXTO} />
        </TouchableOpacity>
      </View>

      <Modal visible={abierto} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar el menú" />
        <View style={[styles.menu, { top: pos.y + pos.h + 4, left: izquierda, width: ANCHO_MENU, borderColor: tema.primary }]}>
          {acciones.map((a, i) => (
            <TouchableOpacity
              key={a.etiqueta}
              style={[styles.fila, i > 0 && styles.separador]}
              onPress={() => elegir(a)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={a.etiqueta}
            >
              <Ionicons name={a.icono} size={22} color={a.peligro ? ROJO : TEXTO} />
              <Text style={[styles.texto, a.peligro && { color: ROJO, fontWeight: 'bold' }]}>{a.etiqueta}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  boton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  fondo: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  fila: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  separador: { borderTopWidth: 1, borderTopColor: '#eee' },
  texto: { flex: 1, fontSize: 17, color: TEXTO },
});