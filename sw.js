/* 제출 활주로 — 서비스워커
 *
 * 목적은 오프라인 기동입니다. PC를 켰을 때 네트워크가 아직 안 붙어 있어도
 * 앱이 즉시 뜨고 알림을 띄울 수 있어야 하므로, 셸은 캐시 우선으로 냅니다.
 * 다만 conferences.json 은 네트워크 우선(실패 시 캐시)으로 두어
 * 저장소에서 마감일을 고치면 다음 실행에 바로 반영되게 합니다.
 */
const VERSION = "cr-v4";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .catch(() => {})            // 아이콘 하나 없다고 설치가 실패하면 안 됨
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 구글 폰트 등은 브라우저에 맡김

  // 데이터: 네트워크 우선 → 실패 시 캐시
  if (url.pathname.endsWith("conferences.json")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 셸: 캐시 우선 → 없으면 네트워크 → 그것도 실패하면 index
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    )
  );
});

// 알림 클릭 시 이미 열린 창이 있으면 그쪽으로 포커스
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
      for (const c of cs) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
