import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { encodeMP3 } from '../src/audio-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const TEST_MP3 = path.join(FIXTURE_DIR, 'test.mp3');

test.beforeAll(async () => {
  // Create fixtures directory if it doesn't exist
  if (!fs.existsSync(FIXTURE_DIR)) {
    fs.mkdirSync(FIXTURE_DIR);
  }

  // Generate a 0.5-second silent stereo audio buffer
  const sampleRate = 44100;
  const duration = 0.5;
  const numSamples = sampleRate * duration;
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Simple silent sine wave
  for (let i = 0; i < numSamples; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.1;
    right[i] = Math.sin((2 * Math.PI * 880 * i) / sampleRate) * 0.1;
  }

  console.log('Generating dummy MP3 fixture for integration test...');
  const blob = await encodeMP3([left, right], sampleRate, { bitrate: 128 });
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(TEST_MP3, buffer);
  console.log(
    `Dummy MP3 generated at ${TEST_MP3} (${buffer.byteLength} bytes)`
  );
});

test.afterAll(() => {
  // Clean up fixture
  if (fs.existsSync(TEST_MP3)) {
    fs.unlinkSync(TEST_MP3);
  }
});

test('Should load app, upload MP3, and convert to WAV', async ({ page }) => {
  await page.goto('/');

  // Check page header
  await expect(page.locator('h1')).toHaveText('Local Audio Converter MVP');

  // Verify elements are present
  const fileInput = page.locator('#file-input');
  const convertBtn = page.locator('#convert-btn');

  await expect(fileInput).toBeHidden(); // Hidden input
  await expect(convertBtn).toBeHidden();

  // Upload file
  console.log('Uploading test MP3 file...');
  await fileInput.setInputFiles(TEST_MP3);

  // Verify file name display
  await expect(page.locator('#file-name')).toHaveText('test.mp3');

  // Select target format: WAV (32-bit Float)
  await page.selectOption('#format-select', 'wav');
  await page.selectOption('#wav-depth', '32');

  // Click convert
  await expect(convertBtn).toBeVisible();
  await expect(convertBtn).toBeEnabled();
  console.log('Clicking convert button...');
  await convertBtn.click();

  // Wait for results card to be visible
  console.log('Waiting for conversion results...');
  const resultSection = page.locator('#result-section');
  await expect(resultSection).toBeVisible({ timeout: 10000 });

  // Verify download link is present and correct
  const downloadLink = page.locator('#download-link');
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).toHaveText('Download WAV');

  const href = await downloadLink.getAttribute('href');
  expect(href).toMatch(/^blob:/); // Should be a blob URL

  console.log('Smoke test passed successfully!');
});
