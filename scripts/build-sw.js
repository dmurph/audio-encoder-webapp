import { generateSW } from 'workbox-build';

generateSW({
  globDirectory: '.',
  globPatterns: [
    'index.html',
    'manifest.json',
    'dist/main.js',
    'dist/worker.js',
    'dist/styles.css',
    'assets/icon-*.png',
  ],
  swDest: 'sw.js',
  clientsClaim: true,
  skipWaiting: true,
})
  .then(({ count, size }) => {
    console.log(
      `Generated sw.js, which will precache ${count} files, totaling ${size} bytes.`
    );
  })
  .catch((err) => {
    console.error('Failed to generate Service Worker:', err);
    process.exit(1);
  });
