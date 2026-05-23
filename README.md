# Local Audio Converter

This is intended to be a reasonably fast and simple audio encoding web app, running fully locally in JS/WASM.

## Live Application
You can access the live web app hosted on GitHub Pages here:
👉 **[https://dmurph.github.io/audio-encoder-webapp/](https://dmurph.github.io/audio-encoder-webapp/)**

## Features
*   **Fully Client-Side**: All audio conversion is performed locally in your browser using WebAssembly. Your audio files are never uploaded to a server, ensuring 100% privacy.
*   **High Performance**: Uses a compiled WASM port of the LAME encoder which is 3x to 5x faster than pure JS implementations.
*   **VBR & CBR Support**: Supports both Constant Bitrate (CBR) and Variable Bitrate (VBR) encoding for MP3.
*   **Offline Capable (PWA)**: Installable as a Progressive Web App (PWA) on your device. Once installed, it runs completely offline without an internet connection.

## Development

### Build
To format the code, compile TypeScript, and bundle the worker:
```bash
npm run build
```

### Run Locally
To run a local development server on port 8080:
```bash
npm start
```
Then open `http://localhost:8080` in your browser.

### Test
To run the Node-based unit test suite:
```bash
npm test
```
