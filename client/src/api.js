import { useState, useEffect } from "react";

// Client alag Static Site par ho to VITE_API_URL me server ka address do
// (jaise https://taratarini-vision-api.onrender.com). Khali ho to usi address par /api chalega.
const API_BASE = (import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

// page khulte hi server ko jaga do (free server 15 minute baad so jata hai)
if (API_BASE) {
  fetch(API_BASE + "/api/health", { mode: "no-cors" }).catch(() => {});
}

export const getToken = () => {
  try {
    return localStorage.getItem("ao_tk") || "";
  } catch {
    return "";
  }
};
export const setToken = (t) => {
  try {
    t ? localStorage.setItem("ao_tk", t) : localStorage.removeItem("ao_tk");
  } catch {
    /* ignore */
  }
};

let toastFn = () => {};
export const onToast = (f) => {
  toastFn = f;
};
export const toast = (m, bad) => toastFn(m, bad);
export const refresh = () => window.dispatchEvent(new Event("ao-refresh"));

export async function api(path, method = "GET", body) {
  const tk = getToken();
  let res;
  try {
    res = await fetch(API_BASE + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(tk ? { Authorization: "Bearer " + tk } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Server se connect nahi ho paya. Server jag raha ho sakta hai, 1 minute baad dobara try karo.",
    );
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && tk) {
    setToken("");
    window.dispatchEvent(new Event("ao-logout"));
  }
  if (!res.ok) throw new Error(data.error || "Kuch gadbad hui");
  return data;
}

// button action: call + toast + sabka data refresh
export async function act(path, method, body) {
  try {
    const d = await api(path, method, body);
    toast(d.message || "Ho gaya");
    refresh();
    return true;
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED") toast(e.message, true);
    return false;
  }
}

// data laao, har 30 second aur har refresh par dobara laao
export function useFetch(path, enabled = true) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const loadData = async () => {
      try {
        const result = await api(path);

        if (!cancelled) {
          setData(result);
        }
      } catch (e) {
        if (!cancelled && e.message !== "SESSION_EXPIRED") {
          toast(e.message, true);
        }
      }
    };

    // Initial load
    loadData();

    // Refresh every 30 seconds
    const timer = setInterval(loadData, 30000);

    // Manual refresh event
    window.addEventListener("ao-refresh", loadData);

    return () => {
      cancelled = true;
      clearInterval(timer);

      window.removeEventListener("ao-refresh", loadData);
    };
  }, [path, enabled]);

  return enabled ? data : null;
}
