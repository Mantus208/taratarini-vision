import { useState } from "react";
import { act, useFetch } from "../api";
import { CmpCard } from "../components";

export default function Complaints({ me }) {
  const P = me.perms;
  const [f, setF] = useState({
    category: "Optical Cable (Field)",
    scope: "Single",
    location: "",
    description: "",
  });
  const list = useFetch("/complaints") || [];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const send = async () => {
    if (await act("/complaints", "POST", f))
      setF({ ...f, location: "", description: "" });
  };
  const open = list.filter((c) => c.status === "Open");
  const done = list.filter((c) => c.status === "Resolved");

  return (
    <>
      {P.canRaiseComplaint && (
        <div className="card">
          <h3>🎫 Nayi Complaint (Ticket)</h3>
          <div className="row2">
            <div>
              <label>Category</label>
              <select value={f.category} onChange={set("category")}>
                <option>Optical Cable (Field)</option>
                <option>Office</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label>Kitna affect?</label>
              <select value={f.scope} onChange={set("scope")}>
                <option value="Single">Ek customer</option>
                <option value="Area">Area (kai customer)</option>
                <option value="Village">Poora gaon off</option>
                <option value="Main">Main line</option>
              </select>
            </div>
          </div>
          <label>Location / Customer / Gaon ka naam</label>
          <input value={f.location} onChange={set("location")} />
          <label>Problem ka detail</label>
          <textarea value={f.description} onChange={set("description")} />
          <button className="btn" onClick={send}>
            Ticket banao
          </button>
        </div>
      )}
      <div className="card">
        <h3>🔥 Open (priority ke hisaab se) - {open.length}</h3>
        {open.map((c) => (
          <CmpCard key={c.id} c={c} P={P} />
        ))}
        {!open.length && (
          <span className="muted">Koi open complaint nahi 🎉</span>
        )}
      </div>
      <div className="card">
        <h3>Resolved - {done.length}</h3>
        {done.slice(0, 30).map((c) => (
          <CmpCard key={c.id} c={c} P={P} />
        ))}
        {!done.length && <span className="muted">Kuch nahi</span>}
      </div>
    </>
  );
}
