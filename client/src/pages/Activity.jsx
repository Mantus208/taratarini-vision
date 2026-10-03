import { useState } from "react";
import { useFetch } from "../api";
import { nm, fdt, ACT_ICON, ACT_GROUP } from "../utils";

const FILTERS = [
  ["all", "Sab"],
  ["income", "💰 Paisa (income)"],
  ["request", "💸 Requests / approval / kharid"],
  ["complaint", "🎫 Complaints"],
  ["user", "👥 Users / login"],
];

export default function Activity() {
  const list = useFetch("/activity");
  const [flt, setFlt] = useState("all");
  const rows = (list || []).filter(
    (a) => flt === "all" || ACT_GROUP[a.type] === flt,
  );

  return (
    <>
      <div className="card">
        <h3>🕘 Activity Log</h3>
        <p className="muted">
          Kisne, kab, kya kiya: yahan sab record hota hai. Ye record app se edit
          ya delete nahi ho sakta. Aakhri 200 entries dikhti hain.
        </p>
        <label>Filter</label>
        <select value={flt} onChange={(e) => setFlt(e.target.value)}>
          {FILTERS.map((f) => (
            <option key={f[0]} value={f[0]}>
              {f[1]}
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        <div className="tl">
          {rows.map((a) => (
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
          {!rows.length && (
            <span className="muted">Abhi koi activity nahi</span>
          )}
        </div>
      </div>
    </>
  );
}
