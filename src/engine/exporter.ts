import type { Project } from '../model/types';
import { getFrameCount } from '../core/project';
import { renderProject, type OnionSkin } from './renderer';

const NO_ONION: OnionSkin = { enabled: false, before: 0, after: 0 };

function createContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto 2D');
  return ctx;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportFramePng(project: Project, frameIndex: number): Promise<void> {
  const target = createContext(project.width, project.height);
  const layerScratch = createContext(project.width, project.height);
  const onionScratch = createContext(project.width, project.height);
  renderProject(target, layerScratch, onionScratch, project, frameIndex, NO_ONION);

  const blob = await new Promise<Blob>((resolve, reject) => {
    target.canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('toBlob devolvio null'));
    }, 'image/png');
  });
  download(blob, 'anim2d-frame.png');
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return 'video/webm';
}

export async function exportWebM(project: Project): Promise<void> {
  const count = getFrameCount(project);
  const target = createContext(project.width, project.height);
  const layerScratch = createContext(project.width, project.height);
  const onionScratch = createContext(project.width, project.height);

  const stream = target.canvas.captureStream(project.fps);
  const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start();
  const frameMs = 1000 / project.fps;
  for (let i = 0; i < count; i++) {
    renderProject(target, layerScratch, onionScratch, project, i, NO_ONION);
    await new Promise((resolve) => window.setTimeout(resolve, frameMs));
  }
  recorder.stop();
  await stopped;

  download(new Blob(chunks, { type: 'video/webm' }), 'anim2d.webm');
}
