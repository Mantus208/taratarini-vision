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

  const set = (k) => (e) =>
    setF({
      ...f,
      [k]: e.target.value,
    });

  const send = async () => {
    if (await act("/complaints", "POST", f)) {
      setF({
        ...f,
        location: "",
        description: "",
      });
    }
  };

  const open = list.filter((c) => c.status === "Open");

  const done = list.filter((c) => c.status === "Resolved");

  return (
    <>
      {/* =====================================================
          NEW COMPLAINT
      ===================================================== */}
      {P.canRaiseComplaint && (
        <div className="card complaint-create-card">
          <div className="complaint-create-head">
            <div className="section-icon complaint-main-icon">🎫</div>

            <div>
              <h3>New Complaint</h3>
              <p>Raise your problem as a support ticket.</p>
            </div>
          </div>

          <div className="complaint-form">
            <div className="row2">
              {/* CATEGORY */}
              <div className="field-block">
                <label>Category</label>

                <select value={f.category} onChange={set("category")}>
                  <option>Optical Cable (Field)</option>

                  <option>Office</option>

                  <option>Other</option>
                </select>
              </div>

              {/* SCOPE */}
              <div className="field-block">
                <label>Impact</label>

                <select value={f.scope} onChange={set("scope")}>
                  <option value="Single">Single Customer</option>
                  <option value="Area">Area (Multiple Customers)</option>
                  <option value="Village">Entire Village Offline</option>
                  <option value="Main">Main Line</option>
                </select>
              </div>
            </div>

            {/* LOCATION */}
            <div className="field-block">
              <label>Location / Customer / Village Name</label>

              <input
                value={f.location}
                onChange={set("location")}
                placeholder="Example: Purusottampur"
              />
            </div>

            {/* DESCRIPTION */}
            <div className="field-block">
              <label>Problem Details</label>

              <textarea
                value={f.description}
                onChange={set("description")}
                placeholder="Describe the problem in detail..."
              />
            </div>

            {/* ACTION */}
            <div className="form-actions">
              <button
                type="button"
                className="btn complaint-send-btn"
                onClick={send}
              >
                🎫 Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          OPEN COMPLAINTS
      ===================================================== */}
      <div className="card complaint-list-card open-complaint-card">
        <div className="complaint-list-head">
          <div className="complaint-list-title">
            <div className="complaint-list-icon open-icon">🔥</div>

            <div>
              <h3>Open Complaints</h3>

              <span>Sorted by priority</span>
            </div>
          </div>

          <div className="complaint-count open-count">{open.length}</div>
        </div>

        <div className="complaint-list-body">
          {open.map((c) => (
            <CmpCard key={c.id} c={c} P={P} />
          ))}

          {!open.length && (
            <div className="complaint-empty">
              <div className="complaint-empty-icon success-empty">✓</div>

              <strong>No open complaints</strong>
              <span>All complaints are currently clear 🎉</span>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          RESOLVED
      ===================================================== */}
      <div className="card complaint-list-card resolved-complaint-card">
        <div className="complaint-list-head">
          <div className="complaint-list-title">
            <div className="complaint-list-icon resolved-icon">✅</div>

            <div>
              <h3>Resolved</h3>

              <span>Recently completed complaints</span>
            </div>
          </div>

          <div className="complaint-count resolved-count">{done.length}</div>
        </div>

        <div className="complaint-list-body">
          {done.slice(0, 30).map((c) => (
            <CmpCard key={c.id} c={c} P={P} />
          ))}

          {!done.length && (
            <div className="complaint-empty">
              <div className="complaint-empty-icon">📭</div>

              <strong>Nothing here</strong>
              <span>There are no resolved complaints yet.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
