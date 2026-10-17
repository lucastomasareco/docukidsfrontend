import axios from 'axios';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // el backend en Render puede tardar hasta 60s en "despertar"
});

// Antes de cada request, le pega el token de la sesión actual de Supabase.
// Así ninguna pantalla necesita acordarse de hacerlo a mano.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Reintento automático SOLO para lecturas (GET) que fallan por un corte de red momentáneo
// ("Network Error": el pedido ni llegó al servidor). Al iniciar sesión salen varios pedidos
// a la vez y, si el servidor gratuito de Render está despertando, alguno puede caerse un instante.
// Se reintenta hasta 2 veces, con una pausa corta. NO se reintentan los tiempos de espera
// (ya esperaron 60 s), ni subir, crear, editar o borrar (para no duplicar nada).
const MAX_REINTENTOS = 2;

api.interceptors.response.use(undefined, async (error) => {
  const config: any = error?.config;
  if (!config || axios.isCancel(error)) return Promise.reject(error);

  const esLectura = String(config.method || 'get').toLowerCase() === 'get';
  const fueCorteDeRed = !error.response && error.code === 'ERR_NETWORK';
  const intentos: number = config.__reintentos ?? 0;

  if (esLectura && fueCorteDeRed && intentos < MAX_REINTENTOS) {
    config.__reintentos = intentos + 1;
    await new Promise((resolver) => setTimeout(resolver, 1500 * (intentos + 1)));
    return api(config);
  }
  return Promise.reject(error);
});
