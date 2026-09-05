/**
 * Verifica la firma (Magic Number) de un archivo para asegurarse de que sea una imagen válida.
 * Soporta JPEG, PNG, GIF y WEBP.
 */
export async function verifyImageSignature(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const arr = new Uint8Array(buffer);

  if (arr.length < 4) return false;

  // JPEG: FF D8 FF
  if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47) {
    return true;
  }

  // GIF: 47 49 46 38 (GIF8)
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) {
    return true;
  }

  // WEBP: RIFF .... WEBP
  if (
    arr.length >= 12 &&
    arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 && // RIFF
    arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50 // WEBP
  ) {
    return true;
  }

  return false;
}
