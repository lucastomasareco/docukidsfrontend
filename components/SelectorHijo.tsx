import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useChildren } from '../context/ChildrenContext';
import { colorConOpacidad } from '../lib/fechas';

// Botón "Estás viendo a: Nico ▾" para Docs y Calendario.
// Al tocarlo se abre un menú chico, justo debajo, con los nombres de los hijos.
// Elegir uno cambia de hijo en el momento, sin ir a la pestaña Hijos.
// Si hay un solo hijo, el botón solo informa (sin flechita y sin menú).
// Usa solo "Modal" (igual que la guía), sin librerías nuevas.

const TEXTO = '#1F1F1F';
const ANCHO_MENU_MIN = 200;
const ALTO_FILA = 48;
const FILAS_VISIBLES = 5;

export default function SelectorHijo() {
  const { tema } = useTheme();
  const { hijos, seleccionadoId, seleccionarHijo } = useChildren();
  const { width: anchoPantalla } = useWindowDimensions();
  const botonRef = useRef<View>(null);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const actual = hijos.find((h) => h.id === seleccionadoId);
  if (!actual) return null;
  const puedeCambiar = hijos.length > 1;

  const abrir = () => {
    // Medimos dónde está el botón en la pantalla para pegar el menú debajo.
    botonRef.current?.measureInWindow((x, y, w, h) => {
      setPos({ x, y, w, h });
      setAbierto(true);
    });
  };

  const elegir = (id: number) => {
    seleccionarHijo(id);
    setAbierto(false);
  };

  const anchoMenu = Math.max(ANCHO_MENU_MIN, pos.w);
  // Que el menú nunca se salga por la derecha de la pantalla.
  const izquierda = Math.max(8, Math.min(pos.x, anchoPantalla - anchoMenu - 8));

  return (
    <>
      <View ref={botonRef} collapsable={false} style={styles.contenedor}>
        <TouchableOpacity
          style={[styles.boton, { borderColor: tema.primary }]}
          onPress={abrir}
          disabled={!puedeCambiar}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={
            puedeCambiar ? `Estás viendo a ${actual.name}. Tocá para cambiar de hijo.` : `Estás viendo a ${actual.name}.`
          }
        >
          <Text style={styles.etiqueta} numberOfLines={1}>
            Estás viendo a:{' '}
            <Text style={styles.nombre}>{actual.name}</Text>
          </Text>
          {puedeCambiar && <Ionicons name="chevron-down" size={18} color={TEXTO} />}
        </TouchableOpacity>
      </View>

      <Modal visible={abierto} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAbierto(false)}>
        {/* Fondo suave: tocar afuera cierra el menú sin cambiar nada. */}
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar el menú de hijos" />
        <View
          style={[
            styles.menu,
            { top: pos.y + pos.h + 6, left: izquierda, width: anchoMenu, borderColor: tema.primary, maxHeight: ALTO_FILA * FILAS_VISIBLES },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {hijos.map((h) => {
              const esActual = h.id === seleccionadoId;
              return (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.fila, esActual && { backgroundColor: colorConOpacidad(tema.primary, 0.33) }]}
                  onPress={() => elegir(h.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={esActual ? `${h.name}, seleccionado` : `Ver a ${h.name}`}
                >
                  <Text style={[styles.filaTexto, esActual && styles.nombre]} numberOfLines={1}>
                    {h.name}
                  </Text>
                  {esActual && <Ionicons name="checkmark" size={22} color={TEXTO} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // alignSelf: 'flex-start' + maxWidth: el botón no ocupa todo el ancho, pero tampoco se sale.
  contenedor: { alignSelf: 'flex-start', maxWidth: '100%', marginBottom: 12 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    maxWidth: '100%',
  },
  etiqueta: { flexShrink: 1, fontSize: 16, color: '#3F3F3F' },
  nombre: { fontWeight: 'bold', color: TEXTO },
  fondo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
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
  fila: {
    height: ALTO_FILA,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filaTexto: { flex: 1, fontSize: 17, color: TEXTO },
});
