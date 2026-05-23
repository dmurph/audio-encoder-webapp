/// <reference lib="webworker" />

import { encodeWAV, encodeMP3 } from './audio-utils.js';

self.onmessage = async (e: MessageEvent) => {
  console.log('Worker received message:', e.data);
  const { type, data } = e.data;
  if (type === 'start') {
    if (!data) {
      self.postMessage({
        type: 'error',
        data: 'Worker error: No data payload received',
      });
      return;
    }
    const { channels, sampleRate, format, options } = data;
    if (!channels) {
      self.postMessage({
        type: 'error',
        data: 'Worker error: channels is undefined in data',
      });
      return;
    }

    try {
      let outputBlob: Blob;
      if (format === 'mp3') {
        outputBlob = await encodeMP3(channels, sampleRate, {
          useVbr: options?.mode === 'vbr',
          bitrate: options?.bitrate,
          vbrQuality: options?.vbrQuality,
          onProgress: (percent) => {
            self.postMessage({ type: 'progress', data: percent });
          },
        });
      } else if (format === 'wav') {
        outputBlob = encodeWAV(channels, sampleRate, options?.bitDepth || 16);
      } else {
        throw new Error('Unsupported target format: ' + format);
      }
      self.postMessage({ type: 'done', data: outputBlob });
    } catch (err: any) {
      self.postMessage({ type: 'error', data: err.message });
    }
  }
};
