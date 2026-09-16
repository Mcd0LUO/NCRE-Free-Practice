/* NCRE 刷题 Service Worker：应用外壳 + API/图片运行时缓存，支持离线 */
const CACHE = 'ncre-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // 不缓存登录接口
  if (url.pathname === '/api/login' || url.pathname === '/api/logout') return

  // 图片：缓存优先
  if (url.pathname.startsWith('/images/')) {
    e.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((res) => {
            const c = res.clone()
            caches.open(CACHE).then((cc) => cc.put(req, c))
            return res
          }),
      ),
    )
    return
  }

  // API：网络优先，离线回退缓存
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const c = res.clone()
            caches.open(CACHE).then((cc) => cc.put(req, c))
          }
          return res
        })
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    )
    return
  }

  // 导航与静态资源：网络优先，离线回退缓存 / 应用外壳
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || ['script', 'style', 'font', 'image'].includes(req.destination))) {
          const c = res.clone()
          caches.open(CACHE).then((cc) => cc.put(req, c))
        }
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
  )
})
