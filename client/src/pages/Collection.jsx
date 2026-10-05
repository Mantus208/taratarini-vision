import { useState, useEffect } from "react";
import { act, api, toast, refresh, useFetch } from "../api";
import { DateInput } from "../components";
import { inr, today, fday, fdt } from "../utils";
import "./collection.css";
import "../styles/pages/collection-ui.css";

const pad = (n) => String(n).padStart(2, "0");
const monthStart = () => today().slice(0, 8) + "01";

function lastMonth() {
  const [y, m] = today().split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}` };
}

const sign = (n) => (n >= 0 ? "vc-pos" : "vc-neg");
const TYPE_RANK = { Basic: 1, Package: 2, Addon: 3, Channel: 4 };
const rank = (t) => TYPE_RANK[t] || 9;
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

// ---------- customer ke is range ke packages ----------
function PkgChips({ r }) {
  if (!r.packages.length) {
    return (
      <span className="vc-nopkg">⚠ is range ka package record nahi mila</span>
    );
  }
  return (
    <div className="vc-pks">
      {r.packages.map((p, i) => (
        <span
          key={i}
          className={"vc-pk t-" + p.type + (p.configured ? "" : " bad")}
          title={isIso(p.startDate) ? "Start: " + fday(p.startDate) : ""}
        >
          <i>{p.type}</i> {p.name}
          <b>{p.configured ? inr(p.customerPrice) : "⚠ price set nahi"}</b>
        </span>
      ))}
    </div>
  );
}

// ---------- franchisee ke customers (popup) ----------
function Detail({ id, q, onClose }) {
  const d = useFetch(`/collection/franchisee/${id}?${q}`);
  const [find, setFind] = useState("");
  const key = find.trim().toLowerCase();
  const rows = (d ? d.rows : []).filter(
    (x) =>
      !key ||
      `${x.subscriber} ${x.subNo} ${x.billNo}`.toLowerCase().includes(key),
  );
  const t = rows.reduce(
    (a, x) => ({
      price: a.price + x.price,
      commission: a.commission + x.commission,
      recharge: a.recharge + x.recharge,
      balance: a.balance + x.balance,
    }),
    { price: 0, commission: 0, recharge: 0, balance: 0 },
  );

  return (
    <div className="vc-modal" onClick={onClose}>
      <div className="vc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="vc-sheet-head">
          <div>
            <h3>{d ? d.franchisee.name : "Loading..."}</h3>
            {d && (
              <span className="muted">
                {d.franchisee.staff || "UNASSIGNED"} · {fday(d.from)} se{" "}
                {fday(d.to)} · sirf is range ke bills aur packages
              </span>
            )}
          </div>
          <button className="btn sm gray" onClick={onClose}>
            ✕ Band karo
          </button>
        </div>

        <input
          placeholder="🔍 Subscriber / Sub.No. / Bill No. search"
          value={find}
          onChange={(e) => setFind(e.target.value)}
        />

        <div className="tbl" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Sub.No.</th>
                <th>Subscriber</th>
                <th>Bill date</th>
                <th>Packages / Addons / Channels</th>
                <th className="r">Customer price</th>
                <th className="r">Commission</th>
                <th className="r">Actual recharge</th>
                <th className="r">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.billNo} className={x.priced ? "" : "vc-unpriced"}>
                  <td>{x.subNo}</td>
                  <td>{x.subscriber}</td>
                  <td>{fday(x.date)}</td>
                  <td>
                    <PkgChips r={x} />
                  </td>
                  <td className="r">{inr(x.price)}</td>
                  <td
                    className="r"
                    title={
                      x.hasBasic
                        ? ""
                        : "Basic package nahi, isliye commission nahi"
                    }
                  >
                    {x.hasBasic ? inr(x.commission) : "—"}
                  </td>
                  <td className="r">{inr(x.recharge)}</td>
                  <td className={"r " + sign(x.balance)}>{inr(x.balance)}</td>
                </tr>
              ))}
              {d && !rows.length && (
                <tr>
                  <td colSpan="8">Is range me koi bill nahi</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="4">TOTAL · {rows.length} customers</td>
                  <td className="r">{inr(t.price)}</td>
                  <td className="r">{inr(t.commission)}</td>
                  <td className="r">{inr(t.recharge)}</td>
                  <td className={"r " + sign(t.balance)}>{inr(t.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- settings (Admin) ----------
function Settings({ onClose }) {
  const s = useFetch("/collection/settings");
  const [f, setF] = useState(null);
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("todo");

  if (s && !f) {
    setF({
      franchisees: s.franchisees,
      rates: s.rates,
      packages: s.packagePrices.map((p) => ({
        ...p,
        customerPrice: p.priceSet ? String(p.customerPrice) : "",
      })),
      systemUsers: s.systemUsers || [],
    });
  }
  if (!f) return <div className="card">Loading...</div>;

  const done = (p) => String(p.customerPrice).trim() !== "";
  const live = f.packages.filter((p) => !p.remove);
  const used = live.filter((p) => p.customers > 0);
  const unused = live.filter((p) => !(p.customers > 0));
  const todo = used.filter((p) => !done(p));
  const types = [...new Set(used.map((p) => p.type))].sort(
    (a, b) => rank(a) - rank(b),
  );
  const needle = q.trim().toLowerCase();
  const shown = used
    .filter((p) =>
      flt === "all" ? true : flt === "todo" ? !done(p) : p.type === flt,
    )
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .sort(
      (a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name),
    );
  const pct = used.length
    ? Math.round(((used.length - todo.length) / used.length) * 100)
    : 100;

  const same = (x, p) => x.name === p.name && x.type === p.type;
  const setPrice = (p, v) =>
    setF({
      ...f,
      packages: f.packages.map((x) =>
        same(x, p) ? { ...x, customerPrice: v } : x,
      ),
    });
  const dropPkg = (p) =>
    setF({
      ...f,
      packages: f.packages.map((x) =>
        same(x, p) ? { ...x, remove: true } : x,
      ),
    });

  const updRate = (i, patch) =>
    setF({
      ...f,
      rates: f.rates.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    });
  const delRate = (i) =>
    setF({ ...f, rates: f.rates.filter((_, j) => j !== i) });

  // NAYA: updFr ko update kiya taaki ek se zyada chizein (staff aur hiddenFrom) save ho sakein
  const updFr = (i, patch) =>
    setF({
      ...f,
      franchisees: f.franchisees.map((x, j) =>
        j === i ? { ...x, ...patch } : x,
      ),
    });

  const staffNames = f.rates
    .map((r) =>
      String(r.staff || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  const allAvailableNames = [
    ...new Set([...(f.systemUsers || []), ...staffNames]),
  ].sort();
  const save = async () => {
    const ok = await act("/collection/settings", "PUT", {
      rates: f.rates,
      // NAYA: hiddenFrom data ko server par bhejna
      franchisees: f.franchisees.map((fr) => ({
        ...fr,
        hiddenFrom: fr.hiddenFrom || "",
      })),
      packagePrices: f.packages.map((p) => ({
        name: p.name,
        type: p.type,
        customerPrice: p.customerPrice,
        remove: !!p.remove,
      })),
    });
    if (ok) onClose();
  };

  return (
    <div className="card vc-set">
      <div className="vc-set-top">
        <div>
          <h3>⚙️ Village Collection Settings</h3>
          <p className="muted">
            {s.paytv.configured
              ? "✅ PayTV login set hai"
              : "⚠ Server par PayTV username/password set nahi"}
          </p>
        </div>
        <button className="btn sm gray" onClick={onClose}>
          ✕
        </button>
      </div>

      <h4>📦 Customer ka package / addon / channel price</h4>
      <p className="muted">
        Yahan sirf wahi aate hain jo sync hue customers par mile. Khali = price
        baaki, 0 = free.
      </p>
      <div className="vc-prog">
        <span style={{ width: pct + "%" }} />
      </div>
      <div className="muted">
        {used.length - todo.length}/{used.length} ka price set ·{" "}
        <b>{todo.length} baaki</b>
      </div>

      <div className="vc-filters">
        <button
          className={flt === "todo" ? "on" : ""}
          onClick={() => setFlt("todo")}
        >
          Price baaki ({todo.length})
        </button>
        <button
          className={flt === "all" ? "on" : ""}
          onClick={() => setFlt("all")}
        >
          Sab ({used.length})
        </button>
        {types.map((t) => (
          <button
            key={t}
            className={flt === t ? "on" : ""}
            onClick={() => setFlt(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <input
        placeholder="🔍 Package ka naam dhundo"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="vc-pklist">
        {shown.map((p) => (
          <div
            key={p.name + "|" + p.type}
            className={"vc-pkrow" + (done(p) ? "" : " todo")}
          >
            <div className="vc-pkinfo">
              <b>{p.name}</b>
              <span className="muted">
                <span className={"vc-tag t-" + p.type}>{p.type}</span>
                {p.customers > 0
                  ? `${p.customers} customer`
                  : "kisi customer par nahi"}
                {p.paytvPrice > 0 ? ` · PayTV price ₹${p.paytvPrice}` : ""}
              </span>
            </div>
            <div className="vc-pkprice">
              <span>₹</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="price"
                value={p.customerPrice}
                onChange={(e) => setPrice(p, e.target.value)}
              />
              <button
                type="button"
                onClick={() => setPrice(p, "0")}
                title="Free / bundled"
              >
                Free
              </button>
            </div>
          </div>
        ))}
        {!shown.length && (
          <div className="muted">
            {flt === "todo"
              ? "🎉 Sab package ka price set hai"
              : "Koi package nahi mila"}
          </div>
        )}
      </div>

      {unused.length > 0 && (
        <details className="vc-fold">
          <summary>Ab kisi customer par nahi ({unused.length})</summary>
          <div className="vc-pklist">
            {unused.map((p) => (
              <div key={p.name + "|" + p.type} className="vc-pkrow">
                <div className="vc-pkinfo">
                  <b>{p.name}</b>
                  <span className="muted">
                    <span className={"vc-tag t-" + p.type}>{p.type}</span>
                    {p.customers > 0
                      ? `${p.customers} customer`
                      : "kisi customer par nahi"}
                    {p.paytvPrice > 0 ? ` · PayTV price ₹${p.paytvPrice}` : ""}
                  </span>
                </div>
                <div className="vc-pkprice">
                  <span>₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="price"
                    value={p.customerPrice}
                    onChange={(e) => setPrice(p, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setPrice(p, "0")}
                    title="Free / bundled"
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    onClick={() => dropPkg(p)}
                    title="List se hatao"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="vc-fold">
        <summary>
          👤 Staff aur commission (Basic wale customer par, per customer)
        </summary>
        {f.rates.map((r, i) => (
          <div className="vc-row" key={i}>
            <select
              value={r.staff}
              onChange={(e) => updRate(i, { staff: e.target.value })}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
              }}
            >
              <option value="">— Select Staff —</option>
              {allAvailableNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Commission"
              value={r.commission}
              onChange={(e) => updRate(i, { commission: e.target.value })}
            />
            <button className="btn sm red" onClick={() => delRate(i)}>
              ✕
            </button>
          </div>
        ))}
        <button
          className="btn sm gray"
          onClick={() =>
            setF({ ...f, rates: [...f.rates, { staff: "", commission: 0 }] })
          }
        >
          ➕ Staff jodo
        </button>
      </details>

      <details className="vc-fold">
        <summary>
          🏘️ Kaunsa franchisee kis staff ka (aur kisse chhupana hai)
        </summary>
        {f.franchisees.map((fr, i) => (
          <div
            key={fr.franchiseId}
            style={{
              padding: "16px 12px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {/* Upar wala hissa: Naam aur Select Dropdown */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div
                className="vc-fname"
                style={{
                  fontWeight: "700",
                  color: "var(--text)",
                  fontSize: "14px",
                }}
              >
                {fr.name}
              </div>
              <select
                value={fr.staff || ""}
                onChange={(e) => updFr(i, { staff: e.target.value })}
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  minWidth: "180px",
                  outline: "none",
                }}
              >
                <option value="">— Koi staff nahi —</option>
                {allAvailableNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Niche wala hissa: Chhupane wale clickable chips (Bina text box ke, aur sundar) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "#f8fafc",
                padding: "10px",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <div
                className="muted"
                style={{ fontSize: "12px", fontWeight: "600" }}
              >
                🚫 In users se chhupayein (Click karein):
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {allAvailableNames.map((n) => {
                  const isHidden = (fr.hiddenFrom || "").includes(n);
                  return (
                    <span
                      key={n}
                      onClick={() => {
                        let current = (fr.hiddenFrom || "")
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        if (isHidden) {
                          current = current.filter((s) => s !== n); // Un-hide
                        } else {
                          current.push(n); // Hide
                        }
                        updFr(i, { hiddenFrom: current.join(", ") });
                      }}
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        cursor: "pointer",
                        background: isHidden ? "#fee2e2" : "#ffffff",
                        color: isHidden ? "#b91c1c" : "#64748b",
                        border: `1px solid ${isHidden ? "#f87171" : "#cbd5e1"}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        userSelect: "none",
                        transition: "all 0.2s",
                      }}
                      title={
                        isHidden
                          ? "Click karke un-hide karein"
                          : "Click karke is user se chhupayein"
                      }
                    >
                      {isHidden ? "🚫 " : "➕ "}
                      {n}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </details>

      <div className="vc-savebar">
        <button className="btn" onClick={save}>
          💾 Save
        </button>
        <button className="btn gray" onClick={onClose}>
          Band karo
        </button>
      </div>
    </div>
  );
}

// ---------- main page ----------
export default function Collection({ me }) {
  const P = me.perms;
  const [r, setR] = useState({ from: monthStart(), to: today() });
  const [open, setOpen] = useState(null);
  const [showSet, setShowSet] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [prog, setProg] = useState(null);

  const ok = !!(r.from && r.to);
  const q = `from=${r.from}&to=${r.to}`;
  const data = useFetch(`/collection/summary?${q}`, ok);
  const status = useFetch("/collection/sync/status");

  if (status && status.running && !syncing) {
    setSyncing(true);
  }

  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(async () => {
      try {
        const st = await api("/collection/sync/status");
        setProg(st.progress);
        if (!st.running) {
          setSyncing(false);
          refresh();
          const good = st.result && st.result.ok;
          toast(
            good
              ? `Sync poora: ${st.result.total} bills, ${st.result.packages} package records`
              : "Sync poora hua, kuch cheezein nahi aayin (upar ⚠ dekho)",
            !good,
          );
        }
      } catch {
        setSyncing(false);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [syncing]);

  const startSync = async () => {
    if (!ok) return toast("Pehle date sahi daalo", true);
    if (await act("/collection/sync", "POST", { from: r.from, to: r.to }))
      setSyncing(true);
  };

  const last = data && data.last;

  // 🚀 UPDATED STAFF ISOLATION & HIDDEN LOGIC 🚀
  // 🚀 FINAL STAFF ISOLATION LOGIC (Sabke liye barabar, Admin bypass khatam) 🚀
  let displayStaffData = [];
  let userHasData = true;

  if (data && data.staff) {
    // Login user ka naam nikal rahe hain
    const myName = String(me.name || "")
      .trim()
      .toUpperCase();

    // Math round function totals ke liye
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    const filteredStaff = data.staff.map((s) => {
      // 1. Sirf wahi franchisee rakho jinki hide list me is user ka naam NAHI hai
      const visibleFranchisees = s.franchisees.filter((fr) => {
        const hideList = String(fr.hiddenFrom || "").toUpperCase();
        return !hideList.includes(myName); // Admin ho ya normal user, sab par laagu!
      });

      // 2. Chhupe hue franchisees ka paisa hatakar, naya TOTAL calculate karo
      const newTotals = visibleFranchisees.reduce(
        (acc, fr) => ({
          customers: acc.customers + (fr.customers || 0),
          collection: r2(acc.collection + (fr.collection || 0)),
          wallet: r2(acc.wallet + (fr.wallet || 0)),
          commission: r2(acc.commission + (fr.commission || 0)),
          net: r2(acc.net + (fr.net || 0)),
          unpriced: acc.unpriced + (fr.unpriced || 0),
        }),
        {
          customers: 0,
          collection: 0,
          wallet: 0,
          commission: 0,
          net: 0,
          unpriced: 0,
        },
      );

      // Naya data return karo
      return {
        ...s,
        franchisees: visibleFranchisees,
        totals: newTotals,
      };
    });

    // 3. Jiske paas 0 franchisee bache hain, us staff block ko hi hata do
    displayStaffData = filteredStaff.filter((s) => s.franchisees.length > 0);

    // Agar saare franchisees chhup gaye hain, toh Khali Screen (No Data) dikhao
    if (displayStaffData.length === 0) {
      userHasData = false;
    }
  }

  // Agar user se sabhi franchisees chhupa diye gaye hain, toh usko khali screen dikhao
  if (data && !P.isAdmin && !userHasData) {
    return (
      <div
        className="card muted"
        style={{ textAlign: "center", padding: "50px 20px" }}
      >
        <h3 style={{ margin: "0 0 10px 0" }}>🚫 No Collection Data</h3>
        <p>
          Aapko kisi bhi Franchise collection ka data dekhne ki permission nahi
          hai.
        </p>
        <p style={{ fontSize: "0.9rem" }}>Kripya Admin se sampark karein.</p>
      </div>
    );
  }

  // Normal render (Admin ya assigned staff ke liye)
  return (
    <>
      <div className="card vc-head">
        <div className="vc-title">
          <div>
            <h3>🏘️ Village Collection</h3>
            <span className="muted">
              Working staff ke hisaab se franchisee collection (PayTV se sync)
            </span>
          </div>

          {/* Admin Tools: Settings aur Sync */}
          {P.isAdmin && (
            <div className="vc-actions">
              <button
                className="btn sm gray"
                onClick={() => setShowSet((v) => !v)}
              >
                ⚙️ Settings
              </button>
              <button className="btn sm" onClick={startSync} disabled={syncing}>
                {syncing
                  ? `⏳ Sync ho raha hai${prog && prog.total ? ` (${prog.done}/${prog.total})` : "..."}`
                  : "🔄 PayTV Sync"}
              </button>
            </div>
          )}
        </div>

        <div className="vc-range">
          <div>
            <label>Se</label>
            <DateInput
              value={r.from}
              onChange={(v) => setR({ ...r, from: v })}
            />
          </div>
          <div>
            <label>Tak</label>
            <DateInput value={r.to} onChange={(v) => setR({ ...r, to: v })} />
          </div>
        </div>

        <div className="vc-chips">
          <button onClick={() => setR({ from: today(), to: today() })}>
            Aaj
          </button>
          <button onClick={() => setR({ from: monthStart(), to: today() })}>
            Is mahine
          </button>
          <button onClick={() => setR(lastMonth())}>Pichla mahina</button>
        </div>

        <div className="muted vc-sync">
          {last
            ? `Aakhri sync: ${fdt(last.at)} · ${fday(last.from)} se ${fday(last.to)} · ${last.total} bills`
            : "Abhi tak sync nahi hua"}
        </div>

        {P.isAdmin && last && last.issues && last.issues.length > 0 && (
          <details className="vc-issues">
            <summary>⚠ Sync me {last.issues.length} problem mili</summary>
            <ul>
              {last.issues.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {showSet && P.isAdmin && <Settings onClose={() => setShowSet(false)} />}

      {/* Admin Alerts (Missing Prices) */}
      {data && data.unpricedPackages.length > 0 && P.isAdmin && (
        <div className="vc-note warn">
          <div>
            ⚠ <b>{data.unpriced - data.noPackage}</b> customer ka price poora
            nahi hai. In package/addon ka price set nahi:{" "}
            {data.unpricedPackages.map((p) => (
              <span key={p.name + p.type} className="vc-chipmini">
                {p.isNew ? "🆕 " : ""}
                {p.name} ({p.type}) · {p.customers}
              </span>
            ))}
          </div>
          <button className="btn sm" onClick={() => setShowSet(true)}>
            💰 Price set karo
          </button>
        </div>
      )}

      {/* No Package Alert */}
      {data && data.noPackage > 0 && (
        <div className="vc-note info">
          <div>
            ℹ {data.noPackage} customer ka bill hai par is date range me unka
            koi package record nahi mila.
            {P.isAdmin
              ? " 🔄 PayTV Sync dobara chalao."
              : " Admin se sync karwao."}
          </div>
        </div>
      )}

      {/* Stats Summary (Admin ko overall, Staff ko apna) */}
      {data && (
        <div className="vc-stats">
          <div className="vc-stat">
            <span>Customers billed</span>
            <b>
              {P.isAdmin
                ? data.totals.customers
                : displayStaffData[0]?.totals?.customers || 0}
            </b>
          </div>
          <div className="vc-stat">
            <span>Customer collection</span>
            <b>
              {inr(
                P.isAdmin
                  ? data.totals.collection
                  : displayStaffData[0]?.totals?.collection || 0,
              )}
            </b>
          </div>
          <div className="vc-stat">
            <span>Actual recharge</span>
            <b>
              {inr(
                P.isAdmin
                  ? data.totals.wallet
                  : displayStaffData[0]?.totals?.wallet || 0,
              )}
            </b>
          </div>
          <div className="vc-stat">
            <span>Commission</span>
            <b>
              {inr(
                P.isAdmin
                  ? data.totals.commission
                  : displayStaffData[0]?.totals?.commission || 0,
              )}
            </b>
          </div>
          <div className="vc-stat net">
            <span>Net</span>
            <b>
              {inr(
                P.isAdmin
                  ? data.totals.net
                  : displayStaffData[0]?.totals?.net || 0,
              )}
            </b>
          </div>
        </div>
      )}

      {data && data.totals.customers === 0 && (
        <div className="card muted">
          Is range me koi bill nahi mila.{" "}
          {P.isAdmin ? "Upar 🔄 PayTV Sync dabao." : "Admin se sync karwao."}
        </div>
      )}

      {/* Render Franchise List */}
      {data &&
        displayStaffData.map((s) => (
          <div className="card" key={s.name}>
            <div className="vc-staff-head">
              <div className="vc-avatar">{s.name.charAt(0)}</div>
              <div className="vc-staff-info">
                <b>{s.name}</b>
                <span className="muted">
                  {s.franchisees.length} franchisee · {s.totals.customers}{" "}
                  customers · commission {inr(s.rate)}/customer (Basic par)
                </span>
              </div>
              <div className="vc-net">
                <span>Net</span>
                <b className={sign(s.totals.net)}>{inr(s.totals.net)}</b>
              </div>
            </div>

            <div className="vc-fr-list">
              {s.franchisees.map((f) => (
                <button
                  type="button"
                  className="vc-fr"
                  key={f.franchiseId}
                  onClick={() => setOpen(f.franchiseId)}
                >
                  <div className="vc-fr-name">
                    {f.name}
                    {f.unpriced > 0 && P.isAdmin && (
                      <span
                        className="vc-dot"
                        title="Kuch customers ka price poora nahi"
                      >
                        ⚠
                      </span>
                    )}
                  </div>
                  <div className="vc-fr-meta">
                    <span>
                      <i>Customers</i>
                      <b>{f.customers}</b>
                    </span>
                    <span>
                      <i>Collection</i>
                      <b>{inr(f.collection)}</b>
                    </span>
                    <span>
                      <i>Actual recharge</i>
                      <b>{inr(f.wallet)}</b>
                    </span>
                    <span>
                      <i>Commission</i>
                      <b>{inr(f.commission)}</b>
                    </span>
                    <span>
                      <i>Net</i>
                      <b className={sign(f.net)}>{inr(f.net)}</b>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

      {open && <Detail id={open} q={q} onClose={() => setOpen(null)} />}
    </>
  );
}
