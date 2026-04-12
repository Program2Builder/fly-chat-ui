/**
 * Converts a Fabric canvas's data URL output to a Blob.
 * Uses JPEG at 0.82 quality for a good file-size/quality balance.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Clamps an image's dimensions to a maximum width/height while preserving aspect ratio.
 */
export function clampDimensions(
  width: number,
  height: number,
  maxSize = 1280
): { width: number; height: number } {
  const ratio = Math.min(maxSize / width, maxSize / height, 1)
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}
