import { useWindowDimensions } from 'react-native';

// Por debajo de este ancho (en px) la pantalla se considera "de teléfono".
// Sirve para achicar la barra de arriba y las letras de la barra de abajo SOLO en el celular.
// En PC (y en tablet) nada cambia.
export const ANCHO_TELEFONO = 600;

export default function useTelefono(): boolean {
  const { width } = useWindowDimensions();
  return width < ANCHO_TELEFONO;
}
