# Implementation Plan: MVP Audio Converter

This plan outlines the steps to build a working MVP that decodes an MP3 file locally and re-encodes it (first to WAV as a baseline, then to MP3).

We will use **TypeScript** with a minimal compile-and-serve setup.

## 1. Project Structure

```
audio-encoder/
├── package.json          # Dependencies (TypeScript, dev server)
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── index.html        # Main UI
│   ├── main.ts           # UI logic, worker management
│   ├── worker.ts         # Web Worker for audio processing
│   ├── wav-encoder.ts    # WAV encoding utility
│   └── styles.css        # Simple styling
└── dist/                 # Compiled JavaScript (generated)
```

## 2. Tech Stack Setup
*   **TypeScript**: Compiled to ES2022 modules.
*   **Build Tool**: We can use `tsc` (TypeScript compiler) directly with `--watch` mode. No need for webpack/vite yet if we keep imports simple and use native browser ESM.
*   **Dev Server**: A simple server (e.g., `lite-server` or `serve`) to serve files and handle local security policies for Web Workers.

## 3. MVP Roadmap

### Phase 1: Infrastructure & TS Setup
1.  Initialize `package.json` and install TypeScript.
2.  Configure `tsconfig.json` to output to `dist/` as ES Modules.
3.  Create basic `index.html` and `src/main.ts` to verify the build pipeline.

### Phase 2: MP3 decoding & WAV encoding (Step 1 MVP)
1.  **UI**: Add file input and "Convert" button.
2.  **UI**: Read file as `ArrayBuffer` and send to Web Worker.
3.  **Worker**: Implement `worker.ts`.
4.  **Worker**: Decode MP3 `ArrayBuffer` to PCM using a mock/dummy audio context (or pass it back to main thread if native decode is only available there - *Note: `AudioContext` is not available in Workers, but `OfflineAudioContext` is also main-thread only in some older specs, though `decodeAudioData` is typically main-thread. We may need to decode on main thread and encode on worker, or use a WASM decoder in the worker. Let's start by decoding on the main thread for simplicity, then sending raw PCM to worker for encoding.*)
    *   *Correction*: Native `decodeAudioData` requires `AudioContext` which is **not** available in Web Workers.
    *   *Pipeline*:
        1. Main Thread: Read File -> ArrayBuffer.
        2. Main Thread: Decode ArrayBuffer to `AudioBuffer` (using `AudioContext`).
        3. Main Thread: Extract channel data (Float32Array) and transfer to Worker.
        4. Worker: Receive PCM, encode to WAV.
        5. Worker: Transfer WAV Blob back to Main Thread.
        6. Main Thread: Create Download Link.
5.  **Encoder**: Implement `wav-encoder.ts` (runs in Worker).
6.  Test WAV download.

### Phase 3: MP3 encoding (Step 2 MVP)
1.  Identify a suitable LAME WASM library (e.g., `lamejs` or a compiled WASM version).
2.  Integrate the encoder into `worker.ts`.
3.  Update UI to support MP3 output.
4.  Test MP3 download.

## 4. Open Questions & Technical Nuances

*   **Decoding Location**: Since `AudioContext.decodeAudioData` is main-thread only, we will decode on the main thread. The worker will only handle *encoding*. This keeps the main thread free during the slow encoding phase, which is acceptable because decoding is usually much faster than encoding.
*   **TypeScript configuration**: We need to make sure `tsc` compiles `main.ts` and `worker.ts` such that they can reference each other (via types) but run independently.
