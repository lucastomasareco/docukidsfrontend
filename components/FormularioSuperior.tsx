import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

// Tarjeta de formulario FIJA ARRIBA (nunca más del 45 % de la altura de la
// pantalla). Como el teclado ocupa la mitad de abajo, nunca la tapa y no hace
// falta calcular nada. Si el formulario es largo (Calendario), se desplaza
// dentro de la tarjeta. Se usa en Docs, Calendario e Hijos.
// 
export default function FormularioSuperior({ children }: { children: ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.capa}>
      <ScrollView
        style={[styles.tarjeta, { maxHeight: height * 0.45 }]}
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cubre la pantalla pero deja pasar los toques a lo que hay detrás.
  capa: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none', justifyContent: 'flex-start' },
  tarjeta: {
    flexGrow: 0,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  contenido: { padding: 16 },
});
