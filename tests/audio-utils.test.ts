import { test } from 'node:test';
import assert from 'node:assert';
import {
  parseFloatTo16Bit,
  toInt16,
  interleave16,
  interleave32,
  encodeWAV,
  encodeMP3,
} from '../src/audio-utils.js';

test('parseFloatTo16Bit', () => {
  // Basic mapping
  assert.strictEqual(parseFloatTo16Bit(0), 0);
  assert.strictEqual(parseFloatTo16Bit(1.0), 32767);
  assert.strictEqual(parseFloatTo16Bit(-1.0), -32768);

  // Clamping
  assert.strictEqual(parseFloatTo16Bit(1.5), 32767);
  assert.strictEqual(parseFloatTo16Bit(-1.5), -32768);

  // Half scale
  assert.strictEqual(parseFloatTo16Bit(0.5), 16384);
  assert.strictEqual(parseFloatTo16Bit(-0.5), -16384);
});

test('toInt16', () => {
  const floats = new Float32Array([-1.0, 0, 1.0]);
  const expected = new Int16Array([-32768, 0, 32767]);
  const result = toInt16(floats);
  assert.deepStrictEqual(result, expected);
});

test('interleave16', () => {
  const left = new Float32Array([-1.0, 1.0]);
  const right = new Float32Array([0.0, 0.5]);
  // Expected: left[0] -> right[0] -> left[1] -> right[1]
  // Converted to 16-bit: [-32768, 0, 32767, 16383] (approx)
  const result = interleave16(left, right);
  assert.strictEqual(result.length, 4);
  assert.strictEqual(result[0], -32768);
  assert.strictEqual(result[1], 0);
  assert.strictEqual(result[2], 32767);
  assert.strictEqual(result[3], parseFloatTo16Bit(0.5));
});

test('interleave32', () => {
  const left = new Float32Array([-1.0, 1.0]);
  const right = new Float32Array([0.0, 0.5]);
  const result = interleave32(left, right);
  assert.deepStrictEqual(result, new Float32Array([-1.0, 0.0, 1.0, 0.5]));
});

test('encodeWAV - 16bit stereo', async () => {
  const left = new Float32Array([0.0, 0.5]);
  const right = new Float32Array([-0.5, 0.0]);
  const sampleRate = 44100;
  const bitDepth = 16;

  const blob = encodeWAV([left, right], sampleRate, bitDepth);
  assert.strictEqual(blob.type, 'audio/wav');

  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);

  // Check RIFF header
  assert.strictEqual(readString(view, 0, 4), 'RIFF');
  assert.strictEqual(view.getUint32(4, true), buffer.byteLength - 8);
  assert.strictEqual(readString(view, 8, 4), 'WAVE');

  // Check fmt chunk
  assert.strictEqual(readString(view, 12, 4), 'fmt ');
  assert.strictEqual(view.getUint32(16, true), 16); // Chunk size
  assert.strictEqual(view.getUint16(20, true), 1); // PCM format
  assert.strictEqual(view.getUint16(22, true), 2); // 2 channels
  assert.strictEqual(view.getUint32(24, true), sampleRate);
  assert.strictEqual(view.getUint32(28, true), sampleRate * 2 * 2); // Byte rate
  assert.strictEqual(view.getUint16(32, true), 4); // Block align
  assert.strictEqual(view.getUint16(34, true), 16); // Bit depth

  // Check data chunk
  assert.strictEqual(readString(view, 36, 4), 'data');
  assert.strictEqual(view.getUint32(40, true), 2 * 2 * 2); // 2 samples * 2 channels * 2 bytes
});

test('encodeWAV - 32bit float mono', async () => {
  const mono = new Float32Array([0.0, 1.0, -1.0]);
  const sampleRate = 48000;
  const bitDepth = 32;

  const blob = encodeWAV([mono], sampleRate, bitDepth);
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);

  assert.strictEqual(view.getUint16(20, true), 3); // IEEE Float format
  assert.strictEqual(view.getUint16(22, true), 1); // 1 channel
  assert.strictEqual(view.getUint32(24, true), sampleRate);
  assert.strictEqual(view.getUint16(34, true), 32); // Bit depth
  assert.strictEqual(view.getUint32(40, true), 3 * 4); // 3 samples * 4 bytes
});

function readString(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
}

test('encodeMP3 - stereo 128kbps', async () => {
  // 1 second of stereo audio at 44100Hz
  const left = new Float32Array(44100);
  const right = new Float32Array(44100);
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    right[i] = Math.sin((2 * Math.PI * 880 * i) / 44100);
  }

  const sampleRate = 44100;
  const bitrate = 128;

  let progressCalled = false;
  const blob = await encodeMP3([left, right], sampleRate, {
    bitrate: bitrate,
    onProgress: (percent) => {
      progressCalled = true;
      assert.ok(percent >= 0 && percent <= 100);
    },
  });

  console.log('CBR 128 Blob size:', blob.size);
  assert.strictEqual(blob.type, 'audio/mp3');
  assert.ok(blob.size > 0, 'Blob size should be greater than 0');
  assert.ok(progressCalled, 'Progress callback should have been called');
});

test('encodeMP3 - VBR V2', async () => {
  const left = new Float32Array(44100);
  const right = new Float32Array(44100);
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    right[i] = Math.sin((2 * Math.PI * 880 * i) / 44100);
  }
  const sampleRate = 44100;

  console.log('Running VBR test case...');
  const blob = await encodeMP3([left, right], sampleRate, {
    useVbr: true,
    vbrQuality: 2,
  });
  console.log('VBR V2 Blob size:', blob.size);
  assert.strictEqual(blob.type, 'audio/mp3');
  assert.ok(blob.size > 0);
});

test('encodeMP3 - VBR V8', async () => {
  const left = new Float32Array(44100);
  const right = new Float32Array(44100);
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    right[i] = Math.sin((2 * Math.PI * 880 * i) / 44100);
  }
  const sampleRate = 44100;

  console.log('Running VBR V8 test case...');
  const blob = await encodeMP3([left, right], sampleRate, {
    useVbr: true,
    vbrQuality: 8,
  });
  console.log('VBR V8 Blob size:', blob.size);
  assert.strictEqual(blob.type, 'audio/mp3');
  assert.ok(blob.size > 0);
});
