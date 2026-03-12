// Type declarations for the native CompressionStream and DecompressionStream APIs.
// Required because some TypeScript DOM lib versions omit these.
// https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream

interface CompressionStream extends GenericTransformStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

declare var CompressionStream: {
  prototype: CompressionStream;
  new(format: 'gzip' | 'deflate' | 'deflate-raw'): CompressionStream;
};

interface DecompressionStream extends GenericTransformStream {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

declare var DecompressionStream: {
  prototype: DecompressionStream;
  new(format: 'gzip' | 'deflate' | 'deflate-raw'): DecompressionStream;
};
