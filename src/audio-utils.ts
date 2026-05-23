import { createMp3Encoder } from 'wasm-media-encoders';

export function encodeWAV(
  channels: Float32Array[],
  sampleRate: number,
  bitDepth: number
): Blob {
  const numChannels = channels.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;

  console.log(
    `WAV Encoder: Encoding ${numChannels} channels at ${sampleRate}Hz, ${bitDepth}-bit`
  );

  let pcmData: ArrayBufferView;
  let formatCategory = 1; // PCM

  if (bitDepth === 16) {
    formatCategory = 1; // PCM
    if (numChannels === 2) {
      pcmData = interleave16(channels[0], channels[1]);
    } else {
      pcmData = toInt16(channels[0]);
    }
  } else if (bitDepth === 32) {
    formatCategory = 3; // IEEE Float
    if (numChannels === 2) {
      pcmData = interleave32(channels[0], channels[1]);
    } else {
      pcmData = channels[0]; // Already Float32Array
    }
  } else {
    throw new Error('Unsupported bit depth: ' + bitDepth);
  }

  const buffer = new ArrayBuffer(44 + pcmData.byteLength);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + pcmData.byteLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, formatCategory, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate */
  view.setUint32(28, byteRate, true);
  /* block align */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, pcmData.byteLength, true);

  // Write PCM data
  if (bitDepth === 16) {
    const wavDataView = new Int16Array(
      buffer,
      44,
      (pcmData as Int16Array).length
    );
    wavDataView.set(pcmData as Int16Array);
  } else {
    const wavDataView = new Float32Array(
      buffer,
      44,
      (pcmData as Float32Array).length
    );
    wavDataView.set(pcmData as Float32Array);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function interleave16(
  inputL: Float32Array,
  inputR: Float32Array
): Int16Array {
  const length = inputL.length + inputR.length;
  const result = new Int16Array(length);
  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = parseFloatTo16Bit(inputL[inputIndex]);
    result[index++] = parseFloatTo16Bit(inputR[inputIndex]);
    inputIndex++;
  }
  return result;
}

export function interleave32(
  inputL: Float32Array,
  inputR: Float32Array
): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

export function toInt16(input: Float32Array): Int16Array {
  const result = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    result[i] = parseFloatTo16Bit(input[i]);
  }
  return result;
}

export function parseFloatTo16Bit(val: number): number {
  const s = Math.max(-1, Math.min(1, val));
  return Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export interface MP3EncoderOptions {
  bitrate?: number;
  useVbr?: boolean;
  vbrQuality?: number;
  onProgress?: (percent: number) => void;
}

export async function encodeMP3(
  channels: Float32Array[],
  sampleRate: number,
  options: MP3EncoderOptions = {}
): Promise<Blob> {
  const numChannels = channels.length;
  const { bitrate = 128, useVbr = false, vbrQuality = 4, onProgress } = options;

  if (useVbr) {
    console.log(
      `WASM MP3 Encoder: Encoding VBR q=${vbrQuality}, ${numChannels} channels at ${sampleRate} Hz`
    );
  } else {
    console.log(
      `WASM MP3 Encoder: Encoding CBR ${bitrate} kbps, ${numChannels} channels at ${sampleRate} Hz`
    );
  }

  const encoder = await createMp3Encoder();

  const config: any = {
    sampleRate: sampleRate,
    channels: numChannels as 1 | 2,
  };
  if (useVbr) {
    config.vbrQuality = vbrQuality;
  } else {
    config.bitrate = bitrate;
  }
  encoder.configure(config);

  const mp3Chunks: Uint8Array[] = [];
  const sampleBlockSize = 1152;
  const totalSamples = channels[0].length;

  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const chunks = channels.map((ch) => ch.subarray(i, i + sampleBlockSize));
    const mp3Data = encoder.encode(chunks);
    if (mp3Data.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3Data));
    }

    if (onProgress) {
      const progress = (i / totalSamples) * 100;
      onProgress(progress);
    }
  }

  const finalizeData = encoder.finalize();
  if (finalizeData.length > 0) {
    mp3Chunks.push(new Uint8Array(finalizeData));
  }

  if (onProgress) {
    onProgress(100);
  }

  return new Blob(mp3Chunks as BlobPart[], { type: 'audio/mp3' });
}
