import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = {
  // Lo que se está cargando, ej. "Cargando documentos…".
  texto?: string;
  // Pasado este tiempo sin respuesta, se asume que Render está "despertando" y se avisa.
  demoraMs?: number;
};

// Círculo girando con texto, para cuando se espera al servidor.
// Una carga normal dice solo "Cargando…". Si tarda más de `demoraMs`, explica que
// el servidor está despertando (en el plan gratuito de Render puede tardar hasta un
// minuto la primera vez). El contador arranca cuando el componente aparece y se
// reinicia cada vez que vuelve a aparecer.
export default function EsperaServidor({ texto = 'Cargando…', demoraMs = 6000 }: Props) {
  const [lenta, setLenta] = useState(false);

  useEffect(() => {
    const temporizador = setTimeout(() => setLenta(true), demoraMs);
    return () => clearTimeout(temporizador);
  }, [demoraMs]);

  return (
    <View style={styles.caja} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" />
      <Text style={styles.titulo}>{lenta ? 'Despertando el servidor…' : texto}</Text>
      {lenta && (
        <Text style={styles.detalle}>Esto puede tardar hasta un minuto la primera vez. No cierres la app.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { alignItems: 'center', paddingHorizontal: 24 },
  titulo: { fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginTop: 14, color: '#1F1F1F' },
  detalle: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 6, color: '#3F3F3F' },
});
