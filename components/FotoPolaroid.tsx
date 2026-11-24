import { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { colorConOpacidad } from '../lib/fechas';

type Props = {
  nombre: string;
  // Foto del hijo (o null si no tiene). Sin foto se muestra la inicial del nombre.
  fotoUrl?: string | null;
};

// Foto estilo Polaroid del hijo elegido (solo en PC, debajo de "Registrar hijo").
// Con foto: se ve la foto. Sin foto: la inicial grande sobre el color del tema.
export default function FotoPolaroid({ nombre, fotoUrl }: Props) {
  const { tema } = useTheme();
  const aparecer = useRef(new Animated.Value(0)).current;
  const inicial = nombre.trim().charAt(0).toUpperCase() || '?';

  // Al cambiar de hijo, la foto aparece suavemente.
  useEffect(() => {
    aparecer.setValue(0);
    Animated.timing(aparecer, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [nombre, fotoUrl, aparecer]);

  return (
    <Animated.View style={[styles.marco, { opacity: aparecer }]} accessible accessibilityLabel={`Foto de ${nombre}`}>
      <View style={[styles.foto, { backgroundColor: colorConOpacidad(tema.primary, 0.35) }]}>
        {fotoUrl ? (
          <Image source={{ uri: fotoUrl }} style={styles.imagen} resizeMode="cover" />
        ) : (
          <Text style={styles.inicial}>{inicial}</Text>
        )}
      </View>
      <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Marco blanco con el borde de abajo más ancho, apenas inclinado y con sombra suave.
  marco: {
    alignSelf: 'center',
    width: '86%',
    marginTop: 26,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: '#FBFAF6',
    borderRadius: 4,
    transform: [{ rotate: '-2.5deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  foto: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 2 },
  imagen: { width: '100%', height: '100%' },
  inicial: { fontSize: 110, fontWeight: 'bold', color: '#1F1F1F' },
  nombre: { marginTop: 12, marginBottom: 6, fontSize: 18, fontWeight: '600', fontStyle: 'italic', color: '#3F3F3F', textAlign: 'center' },
});
