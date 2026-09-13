// Minimal service worker — exists only to satisfy PWA "installability" criteria
// (Chrome requires an active service worker before it will offer the
// Add-to-Home-Screen prompt). It intentionally does NOT cache anything: this
// app's entire value is live task data from Google Sheets, and a caching
// service worker risks showing stale data while looking like it's working.
// Every request is passed straight through to the network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
