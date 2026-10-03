import { useFetch } from "../api";
import { inr, nm, fdt, ACT_ICON, ACT_GROUP } from "../utils";
import { ReqCard, CmpCard } from "../components";

export default function Home({ me, sum, go }) {
  const P = me.perms;
  const reqs = useFetch("/requests", P.canApprove);
  const cmps = useFetch("/complaints", P.canViewComplaints);
  const acts = useFetch("/activity", !!P.canViewActivity);
  const pend = (reqs || []).filter((r) => r.canVote && !r.myVote);
  const em = (cmps || []).filter(
    (c) => c.status === "Open" && c.prio === "EMERGENCY",
  );
  const recent = (acts || []).slice(0, 6);

  return (
    <>
      <div className="hero">
        <h3>Namaskar, {me.name} 👋</h3>
        <p>Manage today's accounts and tasks in one place.</p>
        <div className="quick">
          {P.canAddIncome && (
            <button onClick={() => go("ledger")}>➕ Income entry</button>
          )}
          {P.canRequest && (
            <button onClick={() => go("req")}>💸 New Request</button>
          )}
          {P.canRaiseComplaint && (
            <button onClick={() => go("cmp")}>🎫 New Complaint</button>
          )}
        </div>
      </div>

      <div className="grid">
        {P.canViewLedger && (
          <div className="stat t-blue">
            <span>Balance</span>
            <b className={sum.balance >= 0 ? "in" : "out"}>
              {inr(sum.balance)}
            </b>
          </div>
        )}
        {P.canApprove && (
          <div className="stat t-orange">
            <span>Pending Your Approval</span>
            <b>{sum.pendingForMe || 0}</b>
          </div>
        )}
        {P.canViewComplaints && (
          <div className="stat t-red">
            <span>Open Complaints</span>
            <b>{sum.openComplaints || 0}</b>
          </div>
        )}
      </div>

      {pend.length > 0 && (
        <div className="card">
          <h3>⏳ Pending Your Approval</h3>
          {pend.map((r) => (
            <ReqCard key={r.id} r={r} P={P} />
          ))}
        </div>
      )}
      {em.length > 0 && (
        <div className="card">
          <h3>🔴 Emergency Complaints</h3>
          {em.map((c) => (
            <CmpCard key={c.id} c={c} P={P} />
          ))}
        </div>
      )}

      {P.canViewActivity && (
        <div className="card">
          <h3>🕘 Recent Activity</h3>
          <div className="tl">
            {recent.map((a) => (
              <div className="tl-item" key={a.id}>
                <div className={"tl-ic " + (ACT_GROUP[a.type] || "")}>
                  {ACT_ICON[a.type] || "•"}
                </div>
                <div className="tl-body">
                  <div className="tl-txt">{a.text}</div>
                  <div className="tl-meta">
                    {nm(a.by)} · {fdt(a.at)}
                  </div>
                </div>
              </div>
            ))}
            {!recent.length && (
              <span className="muted">No recent activity</span>
            )}
          </div>
          <button className="btn sm gray" onClick={() => go("activity")}>
            View Full Activity Log
          </button>
        </div>
      )}
    </>
  );
}
