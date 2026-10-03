import { act } from "./api";
import { nm, inr, fday, fdt } from "./utils";

export function ReqCard({ r, P }) {
  const buy = () => {
    const a = prompt("Asli kharcha kitna hua? (₹)", r.amount);
    if (a === null) return;
    const n = prompt("Remark (optional)", "") || "";
    act(`/requests/${r.id}/purchase`, "POST", { amount: a, note: n });
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
        {r.type === "Item" ? "Samaan/Zarurat" : "Expense"} · {inr(r.amount)} ·{" "}
        {nm(r.requestedBy)} · {fday(r.date)}
      </span>
      {r.remark && (
        <>
          <br />
          {r.remark}
        </>
      )}
      <br />
      <span className="muted">
        Approval: {r.yes}/{r.need} chahiye ({r.n} partner) ·{" "}
        {r.voters.length
          ? r.voters
              .map((x) => nm(x.user) + (x.vote === "Y" ? " ✔" : " ✘"))
              .join(", ")
          : "abhi kisi ne vote nahi kiya"}
      </span>
      {r.status === "Purchased" && (
        <>
          <br />
          <span className="muted">
            Kharida: {nm(r.purchasedBy)} · {fday(r.purchaseDate)} ·{" "}
            <b>{inr(r.actualAmount)}</b> {r.purchaseNote}
          </span>
        </>
      )}
      <div>
        {r.canVote && (
          <>
            <button className="btn sm" onClick={() => vote("Y")}>
              ✔ Accept {r.myVote === "Y" ? "(aapka vote)" : ""}
            </button>
            <button className="btn sm red" onClick={() => vote("N")}>
              ✘ Reject {r.myVote === "N" ? "(aapka vote)" : ""}
            </button>
          </>
        )}
        {r.status === "Approved" && P.canPurchase && (
          <button className="btn sm gray" onClick={buy}>
            🛒 Kharid liya / Payment kiya
          </button>
        )}
      </div>
    </div>
  );
}

const SCOPE = {
  Single: "Ek customer",
  Area: "Area (kai customer)",
  Village: "Poora gaon off",
  Main: "Main line",
};

export function CmpCard({ c, P }) {
  const resolve = () => {
    const n = prompt("Kya kaam kiya? (resolution note)", "");
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
        {c.status === "Open" ? ` · ${c.hours} ghante se open` : ""}
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
            ✔ Resolve karo
          </button>
        </>
      )}
    </div>
  );
}
