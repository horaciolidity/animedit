type Entry = { img: HTMLImageElement; loaded: boolean; failed: boolean };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeImages(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getImage(src: string): HTMLImageElement | null {
  const entry = entries.get(src);
  if (entry) return entry.loaded ? entry.img : null;

  const img = new Image();
  const created: Entry = { img, loaded: false, failed: false };
  entries.set(src, created);
  img.onload = () => {
    created.loaded = true;
    emit();
  };
  img.onerror = () => {
    created.failed = true;
    emit();
  };
  img.src = src;
  return null;
}

export function isImagePending(src: string): boolean {
  const entry = entries.get(src);
  return !entry || (!entry.loaded && !entry.failed);
}
