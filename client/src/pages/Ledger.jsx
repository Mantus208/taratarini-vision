import { useState } from "react";
import { act, useFetch } from "../api";
import { inr, fday, nm, today } from "../utils";

export default function Ledger({ me }) {
  const P = me.perms;
  const [f, setF] = useState({
    date: today(),
    source: "",
    amount: "",
    remark: "",
  });
  const [flt, setFlt] = useState({ from: "", to: "" });
  const sources = useFetch("/sources", P.canAddIncome);
  const led = useFetch("/ledger", P.canViewLedger);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (await act("/income", "POST", f)) setF({ ...f, amount: "", remark: "" });
  };

  const rows = led
    ? led.rows.filter(
        (r) =>
          (!flt.from || r.date >= flt.from) && (!flt.to || r.date <= flt.to),
      )
    : [];
  const tin = rows
    .filter((r) => r.type === "IN")
    .reduce((a, b) => a + b.amt, 0);
  const tout = rows
    .filter((r) => r.type === "OUT")
    .reduce((a, b) => a + b.amt, 0);

  return (
    <>
      {P.canAddIncome && (
        <div className="card">
          <h3>➕ Paisa aaya (Income entry)</h3>
          <div className="row2">
            <div>
              <label>Date</label>
              <input type="date" value={f.date} onChange={set("date")} />
            </div>
            <div>
              <label>Amount (₹)</label>
              <input
                type="number"
                inputMode="decimal"
                value={f.amount}
                onChange={set("amount")}
              />
            </div>
          </div>
          <label>Source (list se chuno ya naya likho)</label>
          <input
            list="srcs"
            value={f.source}
            onChange={set("source")}
            placeholder="Purusottampur / Mandiapalli / Internet ..."
          />
          <datalist id="srcs">
            {(sources || []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <label>Remark</label>
          <input value={f.remark} onChange={set("remark")} />
          <button className="btn" onClick={save}>
            Save
          </button>
        </div>
      )}
      {P.canViewLedger && led && (
        <div className="card">
          <h3>📒 Ledger</h3>
          <div className="row2">
            <div>
              <label>Se</label>
              <input
                type="date"
                value={flt.from}
                onChange={(e) => setFlt({ ...flt, from: e.target.value })}
              />
            </div>
            <div>
              <label>Tak</label>
              <input
                type="date"
                value={flt.to}
                onChange={(e) => setFlt({ ...flt, to: e.target.value })}
              />
            </div>
          </div>
          <p>
            Aaya: <span className="in">{inr(tin)}</span> &nbsp; Gaya:{" "}
            <span className="out">{inr(tout)}</span> &nbsp; Current Balance:{" "}
            <b>{inr(led.balance)}</b>
          </p>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Details</th>
                  <th className="r">Aaya</th>
                  <th className="r">Gaya</th>
                  <th className="r">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .reverse()
                  .map((r, i) => (
                    <tr key={i}>
                      <td>{fday(r.date)}</td>
                      <td>
                        <b>{r.title}</b>
                        <br />
                        <span className="muted">
                          {r.remark}
                          {r.remark ? " · " : ""}
                          {nm(r.by)}
                        </span>
                      </td>
                      <td className="r in">
                        {r.type === "IN" ? inr(r.amt) : ""}
                      </td>
                      <td className="r out">
                        {r.type === "OUT" ? inr(r.amt) : ""}
                      </td>
                      <td className="r">{inr(r.bal)}</td>
                    </tr>
                  ))}
                {!rows.length && (
                  <tr>
                    <td colSpan="5">Koi entry nahi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
