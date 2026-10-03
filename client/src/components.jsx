import { useState, useRef } from "react";
import { act, api, toast, refresh } from "./api";
import { nm, inr, fday, fdt } from "./utils";

// ---------- dd/mm/yyyy date input ----------
const showDMY = (v) => (v ? v.split("-").reverse().join("/") : "");

function parseDMY(t) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return "";
  const d = +m[1],
    mo = +m[2],
    y = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  )
    return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// value aur onChange dono 'yyyy-mm-dd' me hain, screen par dd/mm/yyyy dikhta hai
export function DateInput({ value, onChange }) {
  const [text, setText] = useState(showDMY(value));
  const [prev, setPrev] = useState(value);
  const pick = useRef(null);

  // bahar se value badle (jaise calendar se chuni), to text bhi usi ke hisaab se badlo
  if (value !== prev) {
    setPrev(value);
    if (value) setText(showDMY(value));
  }

  const handle = (e) => {
    const d = e.target.value.replace(/\D/g, "").slice(0, 8);
    let t = d;
    if (d.length > 4)
      t = d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4);
    else if (d.length > 2) t = d.slice(0, 2) + "/" + d.slice(2);
    setText(t);
    onChange(parseDMY(t));
  };

  const bad = text.length === 10 && !value;

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={text}
        onChange={handle}
        style={{ paddingRight: 42, ...(bad ? { borderColor: "#dc2626" } : {}) }}
      />
      <button
        type="button"
        title="Select from calendar"
        onClick={() =>
          pick.current && pick.current.showPicker && pick.current.showPicker()
        }
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: 0,
          cursor: "pointer",
          fontSize: 18,
          padding: 4,
        }}
      >
        📅
      </button>
      <input
        ref={pick}
        type="date"
        tabIndex={-1}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          padding: 0,
          border: 0,
        }}
      />
    </div>
  );
}

// ---------- request card ----------
export function ReqCard({ r, P }) {
  const buy = () => {
    if (
      !confirm(
        `Mark payment of ${inr(r.amount)}? The amount cannot be changed.`,
      )
    )
      return;
    const n = prompt("Remark (optional)", "") || "";
    act(`/requests/${r.id}/purchase`, "POST", { note: n });
  };
  const vote = (x) => act(`/requests/${r.id}/vote`, "POST", { vote: x });
  return (
    <div className="card inner">
      <b>
        {r.id} · {r.title}
      </b>{" "}
      <span className={"chip " + r.status}>{r.status}</span>
      <br />
      <span className="muted">
        {r.type === "Item" ? "Item / Requirement" : "Expense"} · {inr(r.amount)}{" "}
        · {nm(r.requestedBy)} · {fday(r.date)}
      </span>
      {r.remark && (
        <>
          <br />
          {r.remark}
        </>
      )}
      <br />
      <span className="muted">
        Approval: {r.yes}/{r.need} required ({r.n} partners) ·{" "}
        {r.voters.length
          ? r.voters
              .map((x) => nm(x.user) + (x.vote === "Y" ? " ✔" : " ✘"))
              .join(", ")
          : "No one has voted yet"}
      </span>
      {r.status === "Purchased" && (
        <>
          <br />
          <span className="muted">
            Purchased by: {nm(r.purchasedBy)} · {fday(r.purchaseDate)} ·{" "}
            <b>{inr(r.actualAmount)}</b> {r.purchaseNote}
          </span>
        </>
      )}
      <div>
        {r.canVote && (
          <>
            <button className="btn sm" onClick={() => vote("Y")}>
              ✔ Accept {r.myVote === "Y" ? "(your vote)" : ""}
            </button>
            <button className="btn sm red" onClick={() => vote("N")}>
              ✘ Reject {r.myVote === "N" ? "(your vote)" : ""}
            </button>
          </>
        )}
        {r.status === "Approved" && P.canPurchase && (
          <button className="btn sm gray" onClick={buy}>
            🛒 Purchased / Payment Made ({inr(r.amount)})
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- complaint card ----------
const SCOPE = {
  Single: "Single Customer",
  Area: "Area (Multiple Customers)",
  Village: "Entire Village Offline",
  Main: "Main Line",
};

function getGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is not available on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let message = "Unable to get your location.";

        if (error.code === 1) {
          message =
            "Location permission was denied. Please allow location access.";
        } else if (error.code === 2) {
          message = "Your current location could not be determined.";
        } else if (error.code === 3) {
          message = "Location request timed out. Please try again.";
        }

        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please select an image file."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const MAX_SIZE = 1000;

        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Unable to process the image."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const data = canvas.toDataURL("image/jpeg", 0.6);

        resolve(data);
      };

      img.onerror = () => {
        reject(new Error("Unable to read the image."));
      };

      img.src = reader.result;
    };

    reader.onerror = () => {
      reject(new Error("Unable to read the selected image."));
    };

    reader.readAsDataURL(file);
  });
}

export function CmpCard({ c, P }) {
  const fileRef = useRef(null);
  const [evidence, setEvidence] = useState("");
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visitStarted, setVisitStarted] = useState(
    c.fieldVisit?.status === "Active",
  );
  const [photo, setPhoto] = useState(c.fieldVisit?.hasPhoto ? "saved" : "");
  const [note, setNote] = useState("");
  const openMap = (lat, lng) => {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      alert("Location coordinates are not available.");
      return;
    }

    window.open(
      `https://www.google.com/maps?q=${latitude},${longitude}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const viewEvidence = async () => {
    try {
      setLoadingEvidence(true);

      const res = await fetch(`/api/complaints/${c.id}/evidence`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("ao_tk"),
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to load evidence.");
      }

      setEvidence(data.photo);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingEvidence(false);
    }
  };
  const startVisit = async () => {
    if (busy) return;

    try {
      setBusy(true);

      const gps = await getGps();

      // api() seedha server ka jawab deta hai (act() sirf true/false deta hai)
      const data = await api(
        `/complaints/${c.id}/field-visit/start`,
        "POST",
        gps,
      );

      const token = data.fieldVisit?.visitToken;

      if (!token) {
        alert("Field visit token was not received from the server.");
        return;
      }

      localStorage.setItem(`tv_visit_${c.id}`, token);

      setVisitStarted(true);
      toast(data.message || "Field visit started");
      refresh();
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choosePhoto = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setBusy(true);

      const compressed = await compressImage(file);

      setPhoto(compressed);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    if (busy) return;

    if (!visitStarted) {
      alert("Please start the field visit first.");
      return;
    }

    if (!photo) {
      alert("Please add photo evidence.");
      return;
    }

    if (!note.trim()) {
      alert("Please enter a resolution note.");
      return;
    }

    try {
      setBusy(true);

      // ek hi baar location lo, resume aur resolve dono me wahi use hogi
      const gps = await getGps();

      let visitToken = localStorage.getItem(`tv_visit_${c.id}`);

      // visit kisi aur device par start hua ho to is device par resume karo
      if (!visitToken) {
        const resumed = await api(
          `/complaints/${c.id}/field-visit/resume`,
          "POST",
          gps,
        );

        visitToken = resumed.fieldVisit?.visitToken || "";

        if (!visitToken) {
          alert("Unable to resume the field visit.");
          return;
        }

        localStorage.setItem(`tv_visit_${c.id}`, visitToken);
      }

      const data = await api(`/complaints/${c.id}/resolve`, "POST", {
        ...gps,
        note: note.trim(),
        photoData: photo,
        visitToken,
      });

      localStorage.removeItem(`tv_visit_${c.id}`);

      toast(data.message || "Complaint resolved");
      refresh();
    } catch (e) {
      if (e.message !== "SESSION_EXPIRED") alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card inner">
      <b>{c.id}</b> <span className={"chip " + c.prio}>{c.prio}</span>{" "}
      <span className="chip" style={{ background: "#475569" }}>
        {c.status}
      </span>
      <br />
      <b>{c.location}</b> · {SCOPE[c.scope] || c.scope} · {c.category}
      <br />
      {c.description}
      <br />
      <span className="muted">
        Raised: {nm(c.raisedBy)} · {fdt(c.raised)}
        {c.status === "Open" ? ` · Open for ${c.hours} hours` : ""}
      </span>
      {c.status === "Resolved" && (
        <>
          <br />

          <span className="muted">
            Resolved: {nm(c.resolvedBy)} · {fdt(c.resolved)} · {c.note}
          </span>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {c.fieldVisit?.startLocation?.lat != null &&
              c.fieldVisit?.startLocation?.lng != null && (
                <button
                  type="button"
                  className="btn sm gray"
                  onClick={() =>
                    openMap(
                      c.fieldVisit.startLocation.lat,
                      c.fieldVisit.startLocation.lng,
                    )
                  }
                >
                  📍 View Visit Start
                </button>
              )}

            {c.fieldVisit?.completeLocation?.lat != null &&
              c.fieldVisit?.completeLocation?.lng != null && (
                <button
                  type="button"
                  className="btn sm gray"
                  onClick={() =>
                    openMap(
                      c.fieldVisit.completeLocation.lat,
                      c.fieldVisit.completeLocation.lng,
                    )
                  }
                >
                  📍 View Completion Location
                </button>
              )}

            {c.fieldVisit?.hasPhoto && (
              <button
                type="button"
                className="btn sm gray"
                onClick={viewEvidence}
                disabled={loadingEvidence}
              >
                📷 {loadingEvidence ? "Loading..." : "View Evidence"}
              </button>
            )}
            {c.fieldVisit?.startLocation?.accuracy != null && (
              <span className="muted">
                Start GPS accuracy: ±
                {Math.round(c.fieldVisit.startLocation.accuracy)} m
              </span>
            )}

            {c.fieldVisit?.completeLocation?.accuracy != null && (
              <span className="muted">
                Completion GPS accuracy: ±
                {Math.round(c.fieldVisit.completeLocation.accuracy)} m
              </span>
            )}
          </div>
        </>
      )}
      {c.status === "Open" && P.canResolve && (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 10,
          }}
        >
          {!visitStarted && (
            <button
              type="button"
              className="btn sm"
              onClick={startVisit}
              disabled={busy}
            >
              📍 {busy ? "Getting location..." : "Start Field Visit"}
            </button>
          )}

          {visitStarted && (
            <>
              <div
                style={{
                  padding: "9px 11px",
                  borderRadius: 10,
                  background: "#ecfdf5",
                  color: "#166534",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ✅ Field visit started
              </div>

              <div className="field-block">
                <label>Photo Evidence</label>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={choosePhoto}
                  disabled={busy}
                />

                {photo && (
                  <small className="field-help">✅ Photo evidence added</small>
                )}
              </div>

              <div className="field-block">
                <label>Resolution Note</label>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Describe the work completed..."
                  rows={3}
                  disabled={busy}
                />
              </div>

              <button
                type="button"
                className="btn sm"
                onClick={resolve}
                disabled={busy}
              >
                ✅ {busy ? "Resolving..." : "Complete & Resolve"}
              </button>
            </>
          )}
        </div>
      )}
      {evidence && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid var(--line)",
          }}
        >
          <img
            src={evidence}
            alt={`Evidence for ${c.id}`}
            style={{
              display: "block",
              width: "100%",
              maxHeight: 420,
              objectFit: "contain",
              borderRadius: 10,
            }}
          />

          <button
            type="button"
            className="btn sm gray"
            onClick={() => setEvidence("")}
            style={{ marginTop: 8 }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
