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
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const send = async () => {
    if (await act("/requests", "POST", f))
      setF({ ...f, title: "", amount: "", remark: "" });
  };

  const groups = [
    ["⏳ Pending", list.filter((r) => r.status === "Pending")],
    [
      "✅ Approved (kharidna baaki)",
      list.filter((r) => r.status === "Approved"),
    ],
    [
      "Purchased / Rejected",
      list.filter((r) => r.status === "Purchased" || r.status === "Rejected"),
    ],
  ];

  return (
    <>
      {P.canRequest && (
        <div className="card">
          <h3>📨 Naya Expense / Zarurat Request</h3>
          <label>Type</label>
          <select value={f.type} onChange={set("type")}>
            <option value="Expense">Kharcha (Expense)</option>
            <option value="Item">
              Samaan chahiye (jaise splicing machine cutter)
            </option>
          </select>
          <label>Kis cheez ke liye?</label>
          <input value={f.title} onChange={set("title")} />
          <label>Amount (andaaza ₹)</label>
          <input
            type="number"
            inputMode="decimal"
            value={f.amount}
            onChange={set("amount")}
          />
          <label>Remark / karan</label>
          <textarea value={f.remark} onChange={set("remark")} />
          <button className="btn" onClick={send}>
            Request bhejo
          </button>
        </div>
      )}
      {groups.map(([title, items]) => (
        <div className="card" key={title}>
          <h3>
            {title} ({items.length})
          </h3>
          {items.map((r) => (
            <ReqCard key={r.id} r={r} P={P} />
          ))}
          {!items.length && <span className="muted">Kuch nahi</span>}
        </div>
      ))}
    </>
  );
}
