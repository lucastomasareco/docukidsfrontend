// Copiar texto al portapapeles en la versión web, sin instalar paquetes.
// Devuelve true si se pudo copiar. En el teléfono no se usa: allí se comparte con Share.

export async function copiarTexto(texto: string): Promise<boolean> {
  // Camino moderno (necesita https o localhost).
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // sigue con el camino de respaldo
  }
  // Respaldo para navegadores o ventanas (Electron) donde el anterior no está disponible.
  try {
    const doc: any = typeof document !== 'undefined' ? document : undefined;
    if (!doc) return false;
    const campo = doc.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('readonly', '');
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    doc.body.appendChild(campo);
    campo.select();
    const ok = !!doc.execCommand?.('copy');
    doc.body.removeChild(campo);
    return ok;
  } catch {
    return false;
  }
}
