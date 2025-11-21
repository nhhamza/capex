import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { FilePicker } from "@capawesome/capacitor-file-picker";

/**
 * Pick images from device gallery (native only)
 * Returns array of webPath URIs that can be converted to Blobs
 */
export async function pickImageUris(limit = 1): Promise<string[]> {
  if (!Capacitor.isNativePlatform()) return [];

  try {
    const result = await Camera.pickImages({
      limit,
      quality: 80,
    });
    return result.photos.map((p) => p.webPath!).filter(Boolean);
  } catch (err) {
    console.error("Error picking images:", err);
    return [];
  }
}

/**
 * Pick any files from device (native only)
 * Returns array of {name, uri, mime} objects
 */
export async function pickAnyFiles(): Promise<
  { name: string; uri: string; mime?: string }[]
> {
  if (!Capacitor.isNativePlatform()) return [];

  try {
    const { files } = await FilePicker.pickFiles({
      readData: false,
    });

    return files
      .map((f) => ({
        name: f.name ?? "file",
        uri: f.path ?? (f.blob ? URL.createObjectURL(f.blob as Blob) : ""),
        mime: f.mimeType,
      }))
      .filter((f) => f.uri);
  } catch (err) {
    console.error("Error picking files:", err);
    return [];
  }
}

/**
 * Convert a webPath (from Camera.pickImages) to a Blob
 * Useful for uploading to Firebase Storage
 */
export async function blobFromWebPath(webPath: string): Promise<Blob> {
  const response = await fetch(webPath);
  return await response.blob();
}
