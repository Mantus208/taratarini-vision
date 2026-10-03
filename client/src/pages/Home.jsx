import { useFetch } from "../api";
import { inr } from "../utils";
import { ReqCard, CmpCard } from "../components";

export default function Home({ me, sum }) {
  const P = me.perms;
  const reqs = useFetch("/requests", P.canApprove);
  const cmps = useFetch("/complaints", P.canViewComplaints);
  const pend = (reqs || []).filter((r) => r.canVote && !r.myVote);
  const em = (cmps || []).filter(
    (c) => c.status === "Open" && c.prio === "EMERGENCY",
  );

  return (
    <>
      <div className="card">
        <h3>Namaste, {me.name} 👋</h3>
        <div className="grid">
          {P.canViewLedger && (
            <div className="stat">
              Balance
              <b className={sum.balance >= 0 ? "in" : "out"}>
                {inr(sum.balance)}
              </b>
            </div>
          )}
          {P.canApprove && (
            <div className="stat">
              Aapke approval pending<b>{sum.pendingForMe || 0}</b>
            </div>
          )}
          {P.canViewComplaints && (
            <div className="stat">
              Open complaints<b>{sum.openComplaints || 0}</b>
            </div>
          )}
        </div>
      </div>
      {pend.length > 0 && (
        <div className="card">
          <h3>⏳ Aapke approval ke liye pending</h3>
          {pend.map((r) => (
            <ReqCard key={r.id} r={r} P={P} />
          ))}
        </div>
      )}
      {em.length > 0 && (
        <div className="card">
          <h3>🔴 Emergency complaints</h3>
          {em.map((c) => (
            <CmpCard key={c.id} c={c} P={P} />
          ))}
        </div>
      )}
    </>
  );
}
