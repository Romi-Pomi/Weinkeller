
const CACHE="weinkeller-v3";
const ASSETS=["./","./index.html","./app.js","./manifest.webmanifest"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{
  if(e.request.url.includes("cdn.jsdelivr.net")) return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
