import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import useEscritorio from '../lib/useEscritorio';

// Alto de la vista previa (el de siempre) y borde gris que queda a cada lado de la imagen en PC.
const ALTO = 220;
const BORDE_LADO = 5;

// Vista previa de la imagen que se está subiendo.
// - Celular: igual que siempre (ocupa todo el ancho de la tarjeta).
// - PC / portátil (ventana de 900 px o más): el recuadro gris se ajusta a la imagen, con solo
//   BORDE_LADO px de gris a cada lado, en vez de ocupar todo el ancho. El alto no cambia.
export default function VistaPreviaImagen({ uri }: { uri: string }) {
  const escritorio = useEscritorio();
  const [medidas, setMedidas] = useState<{ w: number; h: number } | null>(null);
  const [anchoDisponible, setAnchoDisponible] = useState(0);

  useEffect(() => {
    let vivo = true;
    setMedidas(null);
    Image.getSize(
      uri,
      (w, h) => { if (vivo && w > 0 && h > 0) setMedidas({ w, h }); },
      () => {},
    );
    return () => { vivo = false; };
  }, [uri]);

  let ancho: number | string = '100%';
  if (escritorio && medidas && anchoDisponible > 0) {
    const anchoImagen = Math.round((medidas.w / medidas.h) * ALTO);
    ancho = Math.min(anchoDisponible, anchoImagen + BORDE_LADO * 2);
  }

  return (
    <View style={styles.contenedor} onLayout={(e) => setAnchoDisponible(e.nativeEvent.layout.width)}>
      <Image source={{ uri }} style={[styles.imagen, { width: ancho as any }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { width: '100%', alignItems: 'center' },
  imagen: { height: ALTO, borderRadius: 8, marginBottom: 12, resizeMode: 'contain', backgroundColor: '#EEE' },
});
