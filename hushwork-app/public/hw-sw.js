// Hushwork's service worker: push notifications ONLY (no caching, no offline pages). Settings > Notifications registers it when the person
// switches push on. A push holds a title, a short line and one Hushwork address; tapping it opens that address (a review page that shows the
// exact words first, or the Runs page). Nothing here can approve anything.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" ? data.title.slice(0, 80) : "Hushwork";
  const body = typeof data.body === "string" ? data.body.slice(0, 200) : "A step is waiting for you.";
  let url = "/app/runs";
  try { const u = new URL(data.url, self.location.origin); if (u.origin === self.location.origin) url = u.pathname + u.search; } catch { /* keep Runs */ }
  event.waitUntil(self.registration.showNotification(title, { body, tag: typeof data.tag === "string" ? data.tag : "hw", data: { url }, icon: "/icon.svg", badge: "/icon.svg" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/app/runs";
  event.waitUntil(self.clients.openWindow(url));
});
