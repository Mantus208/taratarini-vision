import { useState } from "react";

import { act, useFetch } from "../api";

import { ReqCard } from "../components";

export default function Requests({ me }) {
  const P = me.perms;

  const [f, setF] = useState({
    type: "Expense",
    title: "",
    amount: "",
    remark: "",
  });

  const list = useFetch("/requests") || [];

  const set = (k) => (e) =>
    setF({
      ...f,
      [k]: e.target.value,
    });

  const send = async () => {
    if (await act("/requests", "POST", f)) {
      setF({
        ...f,
        title: "",
        amount: "",
        remark: "",
      });
    }
  };

  const groups = [
    {
      key: "pending",
      title: "Pending",
      icon: "⏳",
      tone: "pending",
      items: list.filter((r) => r.status === "Pending"),
    },
    {
      key: "approved",
      title: "Approved",
      subtitle: "Kharidna baaki",
      icon: "✅",
      tone: "approved",
      items: list.filter((r) => r.status === "Approved"),
    },
    {
      key: "closed",
      title: "Purchased / Rejected",
      icon: "📦",
      tone: "closed",
      items: list.filter(
        (r) => r.status === "Purchased" || r.status === "Rejected",
      ),
    },
  ];

  return (
    <>
      {/* =====================================================
          NEW REQUEST
      ===================================================== */}
      {P.canRequest && (
        <div className="card request-create-card">
          <div className="request-create-head">
            <div className="section-icon request-main-icon">💸</div>

            <div>
              <h3>Naya Expense / Zarurat Request</h3>

              <p>Kharcha ya kisi item ki requirement submit karein.</p>
            </div>
          </div>

          <div className="request-form">
            {/* TYPE */}
            <div className="field-block">
              <label>Type</label>

              <select value={f.type} onChange={set("type")}>
                <option value="Expense">Kharcha (Expense)</option>

                <option value="Item">
                  Samaan chahiye (jaise splicing machine cutter)
                </option>
              </select>
            </div>

            {/* TITLE */}
            <div className="field-block">
              <label>Kis cheez ke liye?</label>

              <input
                value={f.title}
                onChange={set("title")}
                placeholder="Example: Office internet bill"
              />
            </div>

            {/* AMOUNT */}
            <div className="field-block">
              <label>
                Amount (₹)
                <span className="field-help">
                  Approve hone ke baad yahi amount ledger me jayegi
                </span>
              </label>

              <div className="amount-input-wrap">
                <span>₹</span>

                <input
                  type="number"
                  inputMode="decimal"
                  value={f.amount}
                  onChange={set("amount")}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* REMARK */}
            <div className="field-block">
              <label>Remark / karan</label>

              <textarea
                value={f.remark}
                onChange={set("remark")}
                placeholder="Request ka reason likhiye..."
              />
            </div>

            {/* ACTION */}
            <div className="form-actions">
              <button
                type="button"
                className="btn request-send-btn"
                onClick={send}
              >
                📤 Request bhejo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          REQUEST GROUPS
      ===================================================== */}
      <div className="request-groups">
        {groups.map((group) => (
          <div
            className={"card request-group-card " + group.tone}
            key={group.key}
          >
            <div className="request-group-head">
              <div className="request-group-title">
                <div className="request-group-icon">{group.icon}</div>

                <div>
                  <h3>{group.title}</h3>

                  {group.subtitle && <span>{group.subtitle}</span>}
                </div>
              </div>

              <div className="request-count">{group.items.length}</div>
            </div>

            <div className="request-group-body">
              {group.items.map((r) => (
                <ReqCard key={r.id} r={r} P={P} />
              ))}

              {!group.items.length && (
                <div className="request-empty">
                  <div className="request-empty-icon">✓</div>

                  <strong>Kuch nahi</strong>

                  <span>Is section mein abhi koi request nahi hai.</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
