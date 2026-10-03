import { useState } from "react";

import { act, useFetch } from "../api";
import { DateInput } from "../components";
import { inr, fday, nm, today } from "../utils";

export default function Ledger({ me }) {
  const P = me.perms;

  const [f, setF] = useState({
    date: today(),
    source: "",
    amount: "",
    remark: "",
  });

  const [flt, setFlt] = useState({
    from: "",
    to: "",
  });

  const sources = useFetch("/sources", P.canAddIncome);
  const led = useFetch("/ledger", P.canViewLedger);

  const set = (k) => (e) =>
    setF({
      ...f,
      [k]: e.target.value,
    });

  const save = async () => {
    if (
      f.date &&
      f.date !== today() &&
      !confirm(
        `Entry ki date ${f.date
          .split("-")
          .reverse()
          .join("/")} hai (aaj ki date nahi hai). Sahi hai?`,
      )
    ) {
      return;
    }

    if (await act("/income", "POST", f)) {
      setF({
        ...f,
        amount: "",
        remark: "",
      });
    }
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
      {/* =====================================================
          INCOME ENTRY
      ===================================================== */}
      {P.canAddIncome && (
        <div className="card ledger-entry-card">
          <div className="section-head">
            <div className="section-icon income-icon">➕</div>

            <div>
              <h3>Paisa aaya</h3>
              <p>Nayi income entry add karein</p>
            </div>
          </div>

          <div className="row2 ledger-main-fields">
            <div className="field-block">
              <label>Date</label>

              <DateInput
                value={f.date}
                onChange={(v) =>
                  setF({
                    ...f,
                    date: v,
                  })
                }
              />
            </div>

            <div className="field-block">
              <label>Amount (₹)</label>

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
          </div>

          <div className="field-block">
            <label>
              Source
              <span className="field-help">List se chuno ya naya likho</span>
            </label>

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
          </div>

          <div className="field-block">
            <label>Remark</label>

            <input
              value={f.remark}
              onChange={set("remark")}
              placeholder="Optional note..."
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn ledger-save-btn"
              onClick={save}
            >
              💾 Save Income
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}
      {P.canViewLedger && led && (
        <>
          <div className="ledger-summary-grid">
            <div className="ledger-summary income">
              <span>Aaya</span>
              <strong>{inr(tin)}</strong>
              <small>Selected period</small>
            </div>

            <div className="ledger-summary expense">
              <span>Gaya</span>
              <strong>{inr(tout)}</strong>
              <small>Selected period</small>
            </div>

            <div className="ledger-summary balance">
              <span>Current Balance</span>
              <strong>{inr(led.balance)}</strong>
              <small>Available balance</small>
            </div>
          </div>

          {/* =================================================
              LEDGER
          ================================================= */}
          <div className="card ledger-card">
            <div className="ledger-title-row">
              <div className="section-head">
                <div className="section-icon ledger-icon">📒</div>

                <div>
                  <h3>Ledger</h3>
                  <p>Income aur expense ka complete record</p>
                </div>
              </div>
            </div>

            {/* DATE FILTER */}
            <div className="ledger-filter-box">
              <div className="field-block">
                <label>Se</label>

                <DateInput
                  value={flt.from}
                  onChange={(v) =>
                    setFlt({
                      ...flt,
                      from: v,
                    })
                  }
                />
              </div>

              <div className="field-block">
                <label>Tak</label>

                <DateInput
                  value={flt.to}
                  onChange={(v) =>
                    setFlt({
                      ...flt,
                      to: v,
                    })
                  }
                />
              </div>

              <div className="ledger-filter-info">
                <span>Filtered entries</span>
                <strong>{rows.length}</strong>
              </div>
            </div>

            {/* TABLE */}
            <div className="tbl ledger-table">
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
                        <td>
                          <span className="ledger-date">{fday(r.date)}</span>
                        </td>

                        <td>
                          <div className="ledger-detail">
                            <b>{r.title}</b>

                            <span>
                              {r.remark}
                              {r.remark ? " · " : ""}
                              {nm(r.by)}
                            </span>
                          </div>
                        </td>

                        <td className="r">
                          {r.type === "IN" && (
                            <span className="amount-in">+{inr(r.amt)}</span>
                          )}
                        </td>

                        <td className="r">
                          {r.type === "OUT" && (
                            <span className="amount-out">-{inr(r.amt)}</span>
                          )}
                        </td>

                        <td className="r">
                          <span className="balance-value">{inr(r.bal)}</span>
                        </td>
                      </tr>
                    ))}

                  {!rows.length && (
                    <tr>
                      <td colSpan="5" className="empty-ledger">
                        <div className="empty-ledger-box">
                          <div>📭</div>
                          <strong>Koi entry nahi</strong>
                          <span>
                            Selected date range mein koi ledger entry nahi mili.
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
