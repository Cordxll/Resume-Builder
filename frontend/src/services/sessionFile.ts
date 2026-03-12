import { StoredResume, StoredJobDescription, TailoringSession } from '../types/storage';

export interface SessionBundle {
  session: TailoringSession;
  resume: StoredResume;
  jobDescription: StoredJobDescription;
}

interface RtbEnvelope {
  format: 'resume-tailor-backup';
  version: 1;
  exportedAt: string;
  sessions: SessionBundle[];
}

async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data as Uint8Array<ArrayBuffer>);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(data as Uint8Array<ArrayBuffer>);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Export a single session as a .rtb Blob.
 */
export async function exportSessionFile(
  session: TailoringSession,
  resume: StoredResume,
  jobDescription: StoredJobDescription
): Promise<Blob> {
  const envelope: RtbEnvelope = {
    format: 'resume-tailor-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: [{ session, resume, jobDescription }],
  };
  const json = JSON.stringify(envelope);
  const encoded = new TextEncoder().encode(json);
  const compressed = await compress(encoded);
  return new Blob([compressed.buffer as ArrayBuffer], { type: 'application/octet-stream' });
}

/**
 * Export ALL sessions as a single .rtb Blob.
 */
export async function exportAllSessionsFile(bundles: SessionBundle[]): Promise<Blob> {
  const envelope: RtbEnvelope = {
    format: 'resume-tailor-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: bundles,
  };
  const json = JSON.stringify(envelope);
  const encoded = new TextEncoder().encode(json);
  const compressed = await compress(encoded);
  return new Blob([compressed.buffer as ArrayBuffer], { type: 'application/octet-stream' });
}

/**
 * Import sessions from a .rtb file.
 * Returns the parsed bundles for the caller to save to IndexedDB.
 * Throws descriptive errors for invalid files.
 */
export async function importSessionFile(file: File): Promise<SessionBundle[]> {
  const arrayBuffer = await file.arrayBuffer();
  const compressed = new Uint8Array(arrayBuffer);

  let decompressed: Uint8Array;
  try {
    decompressed = await decompress(compressed);
  } catch {
    throw new Error('Invalid file: could not decompress. Is this a valid .rtb file?');
  }

  let envelope: unknown;
  try {
    const json = new TextDecoder().decode(decompressed);
    envelope = JSON.parse(json);
  } catch {
    throw new Error('Invalid file: could not parse JSON content.');
  }

  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    (envelope as Record<string, unknown>)['format'] !== 'resume-tailor-backup'
  ) {
    throw new Error('Invalid file: not a Resume Tailor backup file.');
  }

  const env = envelope as Record<string, unknown>;

  if (typeof env['version'] !== 'number') {
    throw new Error('Invalid file: missing version field.');
  }

  if (env['version'] > 1) {
    throw new Error('This file was created with a newer version of Resume Tailor');
  }

  if (!Array.isArray(env['sessions'])) {
    throw new Error('Invalid file: sessions data is missing or malformed.');
  }

  return env['sessions'] as SessionBundle[];
}

/**
 * Trigger a browser file download for a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
