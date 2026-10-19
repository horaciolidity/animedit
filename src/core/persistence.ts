import type { Camera, EasingKind, Frame, Keyframe, Layer, Project, Stroke, Transform } from '../model/types';
import { IDENTITY } from './transform';
import { createProject } from './project';

const DB_NAME = 'anim2d';
const DB_VERSION = 1;
const STORE = 'projects';

interface StoredProject {
  id: string;
  name: string;
  updatedAt: number;
  data: Project;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

let persistRequested = false;

export async function saveProject(project: Project): Promise<void> {
  if (!persistRequested && navigator.storage?.persist) {
    persistRequested = true;
    void navigator.storage.persist();
  }
  const record: StoredProject = {
    id: project.id,
    name: project.name,
    updatedAt: Date.now(),
    data: project,
  };
  await tx('readwrite', (store) => store.put(record));
}

export async function listProjects(): Promise<StoredProject[]> {
  const all = await tx<StoredProject[]>('readonly', (store) => store.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadMostRecent(): Promise<Project | null> {
  const records = await listProjects();
  return records.length > 0 ? records[0].data : null;
}

export function projectToJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeTransform(raw: unknown): Transform {
  const record = asRecord(raw);
  if (!record) return { ...IDENTITY };
  return {
    x: num(record.x, 0),
    y: num(record.y, 0),
    rotation: num(record.rotation, 0),
    scaleX: num(record.scaleX, 1),
    scaleY: num(record.scaleY, 1),
  };
}

function normalizeCamera(raw: unknown): Camera {
  const record = asRecord(raw) ?? {};
  return {
    transform: normalizeTransform(record.transform),
    keyframes: normalizeKeyframes(record.keyframes),
  };
}

function normalizeKeyframes(raw: unknown): Keyframe[] {
  if (!Array.isArray(raw)) return [];
  const result: Keyframe[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const frame = num(record.frame, -1);
    if (frame < 0) continue;
    result.push({
      frame: Math.floor(frame),
      transform: normalizeTransform(record.transform),
      easing: (record.easing as EasingKind) ?? 'linear',
    });
  }
  return result.sort((a, b) => a.frame - b.frame);
}

function normalizeFrame(raw: unknown): Frame {
  const record = asRecord(raw) ?? {};
  const strokes = Array.isArray(record.strokes) ? (record.strokes as Stroke[]) : [];
  const images = Array.isArray(record.images) ? (record.images as Frame['images']) : [];
  return { strokes, images, exposure: Math.max(1, Math.floor(num(record.exposure, 1))) };
}

function normalizeLayer(raw: unknown, index: number): Layer {
  const record = asRecord(raw) ?? {};
  const frames = Array.isArray(record.frames) ? record.frames.map(normalizeFrame) : [];
    return {
      id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
      name: typeof record.name === 'string' ? record.name : `Capa ${index + 1}`,
      visible: record.visible !== false,
      opacity: Math.min(1, Math.max(0, num(record.opacity, 1))),
      parentId: typeof record.parentId === 'string' ? record.parentId : null,
      transform: normalizeTransform(record.transform),
      keyframes: normalizeKeyframes(record.keyframes),
      frames: frames.length > 0 ? frames : [{ strokes: [], images: [], exposure: 1 }],
    };
}

export function normalizeProject(raw: unknown): Project | null {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.layers)) return null;
  const fallback = createProject();
  const layers = record.layers.map(normalizeLayer);
  return {
    id: typeof record.id === 'string' ? record.id : fallback.id,
    name: typeof record.name === 'string' ? record.name : fallback.name,
    width: Math.max(1, Math.floor(num(record.width, fallback.width))),
    height: Math.max(1, Math.floor(num(record.height, fallback.height))),
    fps: Math.min(60, Math.max(1, Math.floor(num(record.fps, fallback.fps)))),
    camera: normalizeCamera(record.camera),
    palette: Array.isArray(record.palette)
      ? (record.palette as unknown[]).filter((c): c is string => typeof c === 'string')
      : fallback.palette,
    layers: layers.length > 0 ? layers : fallback.layers,
  };
}

export function projectFromJson(text: string): Project | null {
  try {
    return normalizeProject(JSON.parse(text));
  } catch {
    return null;
  }
}
