import { Platform, useWindowDimensions } from 'react-native';

// A partir de este ancho (en px) la pantalla se considera "de escritorio".
// Por debajo (celulares, ventana angosta, modo responsivo) todo se ve igual que siempre.
export const ANCHO_ESCRITORIO = 900;

// true solo en la versión web y con la ventana ancha. En el celular siempre es false.
// Se recalcula sola si se cambia el tamaño de la ventana.
export default function useEscritorio(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= ANCHO_ESCRITORIO;
}
