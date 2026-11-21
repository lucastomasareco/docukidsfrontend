import { StyleSheet, Text, View } from 'react-native';

// Versión para celular: el mapa interactivo existe solo en la web
// (ver MapaLugar.web.tsx). La app ya solo se publica en la web, pero este archivo
// evita que el código de Leaflet entre al compilar para otras plataformas.
export type PropsMapa = {
  lat: number | null;
  lon: number | null;
  editable?: boolean;
  onElegir?: (lat: number, lon: number) => void;
  // Cada vez que cambia este número, el mapa se centra en el pin (ej. al elegir un resultado de la búsqueda).
  enfocar?: number;
  altura?: number;
};

export default function MapaLugar({ altura = 240 }: PropsMapa) {
  return (
    <View style={[styles.caja, { height: altura }]}>
      <Text style={styles.texto}>El mapa está disponible en la versión web de Docukids.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { backgroundColor: '#EEE', borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 16 },
  texto: { color: '#3F3F3F', fontSize: 14, textAlign: 'center' },
});
