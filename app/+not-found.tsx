import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import EstadoVacio from '../components/EstadoVacio';

// Pantalla para direcciones que no existen (enlace viejo, error de tipeo, etc.).
// Reemplaza la pantalla genérica en inglés de Expo Router.
export default function NoEncontrada() {
  const router = useRouter();
  const { tema } = useTheme();

  return (
    <LinearGradient
      colors={tema.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, justifyContent: 'center', padding: 16 }}
    >
      <EstadoVacio
        icono="search-outline"
        titulo="Esta página no existe"
        mensaje="Puede que el enlace sea viejo o que la dirección tenga un error. Volvé al inicio para seguir usando Docukids."
        etiquetaAccion="Ir al inicio"
        onAccion={() => router.replace('/')}
      />
    </LinearGradient>
  );
}