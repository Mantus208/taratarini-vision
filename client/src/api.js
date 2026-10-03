import { useState, useEffect, useCallback } from "react";

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
  const res = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(tk ? { Authorization: "Bearer " + tk } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
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

    toast(d.message || "Done");
    refresh();

    return d;
  } catch (e) {
    if (e.message !== "SESSION_EXPIRED") {
      toast(e.message, true);
    }

    return false;
  }
}

// data laao, har 30 second aur har refresh par dobara laao
export function useFetch(path, enabled = true) {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    api(path)
      .then(setData)
      .catch((e) => {
        if (e.message !== "SESSION_EXPIRED") toast(e.message, true);
      });
  }, [path, enabled]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 30000);
    window.addEventListener("ao-refresh", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("ao-refresh", load);
    };
  }, [load]);
  return data;
}
