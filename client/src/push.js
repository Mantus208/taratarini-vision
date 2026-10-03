import { api } from "./api";

const b64ToUint8 = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error(
      "Is browser me notification support nahi hai (iPhone par pehle Add to Home Screen karo)",
    );
  const perm = await Notification.requestPermission();
  if (perm !== "granted")
    throw new Error("Notification ki permission nahi di gayi");
  const { key } = await api("/push/key");
  if (!key) throw new Error("Server par VAPID key set nahi hai");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(key),
    });
  await api("/push/subscribe", "POST", sub.toJSON());
}
