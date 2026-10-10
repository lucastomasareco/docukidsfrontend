import { useEffect, useRef } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAyuda } from '../context/AyudaContext';
import { AYUDAS } from '../lib/ayudas';

const TEXTO = '#1F1F1F';
const TEXTO_SUAVE = '#3F3F3F';
// Alto estándar de la barra de arriba (sin contar la zona del reloj/batería).
const ALTO_BARRA = Platform.OS === 'ios' ? 44 : 56;

// Tarjeta con la guía de la pantalla actual. NO es un Modal: así la barra de
// arriba (y su botón "?") sigue tocable para cerrarla. Se dibuja justo debajo
// de la barra y deja pasar los toques que no caen sobre la tarjeta.
export default function PanelAyuda() {
  const { tema } = useTheme();
  const { pantalla, abierta } = useAyuda();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const aparicion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (abierta) {
      aparicion.setValue(0);
      Animated.timing(aparicion, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [abierta, aparicion]);

  if (!abierta || !pantalla) return null;
  const ayuda = AYUDAS[pantalla];

  return (
    <View style={[styles.capa, { top: insets.top + ALTO_BARRA + 6 }]} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.tarjeta,
          {
            backgroundColor: tema.card,
            maxHeight: height * 0.6,
            opacity: aparicion,
            transform: [{ translateY: aparicion.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
          },
        ]}
      >
        {/* ScrollView por si la letra del teléfono está en "grande". */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.cabecera}>
            <View style={[styles.circulo, { backgroundColor: tema.primary }]}>
              <Ionicons name="help" size={22} color={TEXTO} />
            </View>
            <Text style={styles.titulo}>{ayuda.titulo}</Text>
          </View>

          {ayuda.consejos.map((c, i) => (
            <View key={i} style={styles.fila}>
              <Ionicons name={c.icono} size={22} color={TEXTO} style={styles.icono} />
              <Text style={styles.texto}>{c.texto}</Text>
            </View>
          ))}

          <Text style={styles.pie}>Tocá el ? de arriba para cerrarla. Si la cerrás, no se abrirá sola en las otras pantallas. Podés volver a verla cuando quieras con el ?.</Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', left: 12, right: 12, zIndex: 50, elevation: 50 },
  tarjeta: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, elevation: 12 },
  cabecera: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  circulo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  titulo: { flex: 1, fontSize: 20, fontWeight: 'bold', color: TEXTO },
  fila: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  icono: { marginRight: 10, marginTop: 1 },
  texto: { flex: 1, fontSize: 16, lineHeight: 22, color: TEXTO_SUAVE },
  pie: { fontSize: 13, lineHeight: 18, color: TEXTO_SUAVE, marginTop: 14, fontStyle: 'italic' },
});
