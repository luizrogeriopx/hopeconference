// Client-only helpers for face-api.js (models loaded lazily from CDN).
// NEVER import this file from a server-only path.

let loadPromise: Promise<typeof import("face-api.js")> | null = null;
let modelsReady = false;

const MODEL_URL =
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

export async function loadFaceApi() {
  if (typeof window === "undefined") throw new Error("face-api só roda no browser");
  if (!loadPromise) {
    loadPromise = import("face-api.js");
  }
  const faceapi = await loadPromise;
  if (!modelsReady) {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsReady = true;
  }
  return faceapi;
}

export async function extrairEmbeddingsDeImagem(
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<number[][]> {
  const faceapi = await loadFaceApi();
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return detections.map((d) => Array.from(d.descriptor));
}

export async function extrairEmbeddingDeArquivo(file: File): Promise<{
  embeddings: number[][];
  largura: number;
  altura: number;
}> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const embeddings = await extrairEmbeddingsDeImagem(img);
    return { embeddings, largura: img.naturalWidth, altura: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function distanciaEuclidiana(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Um match "bom" fica abaixo de ~0.5–0.55 no descritor de 128 dims
export const MATCH_THRESHOLD = 0.55;
