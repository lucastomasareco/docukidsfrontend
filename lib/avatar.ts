import type { ImagePickerAsset } from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Reglas de la foto de perfil de un hijo (issue #36).
// Formatos permitidos: .png, .jpg, .jpeg, .webp. Tamaño máximo: 5 MB.
export const EXTENSIONES_AVATAR = ['png', 'jpg', 'jpeg', 'webp'] as const;
export const MIMES_AVATAR = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const;
export const MAX_AVATAR_MB = 5;
export const MAX_AVATAR_BYTES = MAX_AVATAR_MB * 1024 * 1024;

// La foto ya lista para guardar: reducida y convertida a texto ("data URI").
// Es lo que se muestra en la vista previa y lo que viaja al backend en el mismo
// pedido que crea al hijo (sin subidas aparte).
export type AvatarElegido = {
  dataUri: string; // "data:image/jpeg;base64,..."
  bytes: number; // peso aproximado de la imagen final
};

// Lado de la foto final. 256 px alcanza de sobra para un círculo de 44-96 px y
// deja la imagen en ~15-30 KB: la lista de hijos carga igual de rápido que antes.
export const LADO_AVATAR = 256;
const CALIDAD_JPEG = 0.7;

function extensionDe(texto: string | null | undefined): string | null {
  if (!texto || texto.startsWith('data:') || texto.startsWith('blob:')) return null;
  const limpio = texto.split('?')[0].split('#')[0];
  const punto = limpio.lastIndexOf('.');
  return punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : null;
}

const MIME_POR_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// Revisa la foto que devolvió el selector ANTES de procesarla.
// Devuelve null si está bien, o un texto para mostrarle a la persona si no se puede usar.
export function validarAvatar(asset: ImagePickerAsset): string | null {
  const extension = extensionDe(asset.fileName) ?? extensionDe(asset.uri);
  const mimeDeclarado = asset.mimeType?.toLowerCase() ?? null;
  const mimeFinal = mimeDeclarado ?? (extension ? MIME_POR_EXTENSION[extension] : undefined) ?? null;

  const mimeOk = mimeFinal !== null && (MIMES_AVATAR as readonly string[]).includes(mimeFinal);
  const extensionOk = extension === null || (EXTENSIONES_AVATAR as readonly string[]).includes(extension);
  if (!mimeOk || !extensionOk) {
    return 'Esa imagen no tiene un formato válido. Usá una foto PNG, JPG, JPEG o WEBP.';
  }

  // En la web el tamaño viene en asset.file; en el celular, en asset.fileSize.
  const tamano = asset.fileSize ?? asset.file?.size ?? null;
  if (tamano !== null && tamano > MAX_AVATAR_BYTES) {
    const mb = (tamano / (1024 * 1024)).toFixed(1).replace('.', ',');
    return `La foto pesa ${mb} MB y el máximo es ${MAX_AVATAR_MB} MB. Elegí una más liviana.`;
  }
  return null;
}

// Recorta la foto en cuadrado (desde el centro), la reduce a 256 px y la pasa a JPEG.
// Se hace en el teléfono/navegador: al backend solo llega una imagen chiquita.
// (Un PNG con fondo transparente queda con fondo negro al pasar a JPEG.)
export async function prepararAvatar(asset: ImagePickerAsset): Promise<AvatarElegido> {
  const lado = Math.min(asset.width, asset.height);
  let contexto = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== asset.height) {
    contexto = contexto.crop({
      originX: Math.floor((asset.width - lado) / 2),
      originY: Math.floor((asset.height - lado) / 2),
      width: lado,
      height: lado,
    });
  }
  if (lado > LADO_AVATAR) contexto = contexto.resize({ width: LADO_AVATAR, height: LADO_AVATAR });
  const imagen = await contexto.renderAsync();
  const resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG, base64: true });
  if (!resultado.base64) throw new Error('No se pudo preparar la foto');
  return {
    dataUri: `data:image/jpeg;base64,${resultado.base64}`,
    bytes: Math.round(resultado.base64.length * 0.75),
  };
}
