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