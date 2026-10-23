import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api } from './api';

// En web, cierra el popup y devuelve el resultado a la ventana que lo abrió.
// Al estar acá, se ejecuta en cualquier pantalla que importe este módulo.
WebBrowser.maybeCompleteAuthSession();

/**
 * Abre el flujo de autorización de Google y devuelve el resultado del navegador.
 * `ruta` es la pantalla a la que se vuelve (ej. '/ajustes' o '/login').
 * No toca estados de React: cada pantalla decide qué hacer con el resultado.
 */
export async function abrirAutorizacionGoogle(ruta: string) {
  const returnUrl = Linking.createURL(ruta);
  const respuesta = await api.get('/auth/google/url', { params: { return_to: returnUrl } });
  const url: string = respuesta.data.url;
  const resultado = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  return { resultado, returnUrl };
}