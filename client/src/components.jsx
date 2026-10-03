import { useState, useRef } from "react";
import { act } from "./api";
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

export function CmpCard({ c, P }) {
  const resolve = () => {
    const n = prompt("What work was done? (resolution note)", "");
    if (n === null) return;
    act(`/complaints/${c.id}/resolve`, "POST", { note: n });
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
        Raise: {nm(c.raisedBy)} · {fdt(c.raised)}
        {c.status === "Open" ? ` · ${c.hours} hours since open` : ""}
      </span>
      {c.status === "Resolved" && (
        <>
          <br />
          <span className="muted">
            Resolved: {nm(c.resolvedBy)} · {fdt(c.resolved)} · {c.note}
          </span>
        </>
      )}
      {c.status === "Open" && P.canResolve && (
        <>
          <br />
          <button className="btn sm" onClick={resolve}>
            ✔ Resolve
          </button>
        </>
      )}
    </div>
  );
}
