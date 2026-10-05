import { useState } from "react";
import { act, useFetch } from "../api";
import { PERMS } from "../utils";

// ==========================================
// 1. Right Side Pane: Selected User Editor
// ==========================================
function UserEditor({ u }) {
  const [status, setStatus] = useState(u.status);
  const [pm, setPm] = useState(
    Object.fromEntries(PERMS.map((p) => [p[0], !!u[p[0]]])),
  );

  const save = () =>
    act(`/users/${u.username}`, "PUT", {
      status,
      perms: pm,
    });

  const reset = () => {
    const p = prompt(
      "Enter a new password (minimum 6 characters) - " + u.username,
    );

    if (p) {
      act(`/users/${u.username}/reset-password`, "POST", { newPass: p });
    }
  };

  return (
    <div className="card user-card" style={{ margin: 0, width: "100%" }}>
      {/* USER HEADER */}
      <div className="user-card-head">
        <div>
          <h3 className="user-name">{u.name}</h3>
          <span className="muted">@{u.username}</span>
        </div>
        <span className={"user-status " + status.toLowerCase()}>{status}</span>
      </div>

      {/* STATUS */}
      <div className="field-block" style={{ marginBottom: "16px" }}>
        <label htmlFor={`status-${u.username}`}>Status</label>
        <select
          id={`status-${u.username}`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["Active", "Pending", "Disabled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* PERMISSIONS */}
      <div className="permission-section">
        <div className="permission-title">
          <div>
            <strong>Permissions</strong>
            <span>Select the access this user should have</span>
          </div>
        </div>

        {/* Yahan aapke CSS wale grid ya column layout ka use kiya gaya hai */}
        <div
          className="permissions"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "6px",
          }}
        >
          {PERMS.map((p) => {
            const id = `perm-${u.username}-${p[0]}`;

            return (
              <div className="perm" key={p[0]}>
                <label htmlFor={id}>{p[1]}</label>

                <input
                  id={id}
                  type="checkbox"
                  checked={pm[p[0]]}
                  onChange={(e) =>
                    setPm({
                      ...pm,
                      [p[0]]: e.target.checked,
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="user-actions">
        <button type="button" className="btn sm" onClick={save}>
          💾 Save
        </button>

        <button type="button" className="btn sm gray" onClick={reset}>
          🔑 Reset Password
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 2. Main Page Layout (Split View)
// ==========================================
export default function Users() {
  const users = useFetch("/users");
  const [selectedUsername, setSelectedUsername] = useState(null);

  const safeUsers = users || [];

  // Agar list aa gayi hai aur koi user select nahi hai, toh pehla user auto-select kar lo
  if (safeUsers.length > 0 && !selectedUsername) {
    setSelectedUsername(safeUsers[0].username);
  }

  const selectedUser = safeUsers.find((u) => u.username === selectedUsername);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* INTRO HEADER */}
      <div className="card users-intro" style={{ margin: 0 }}>
        <div className="intro-icon">👥</div>
        <div>
          <h3>Users & Permissions</h3>
          <p className="muted" style={{ margin: 0 }}>
            Select a team member from the list to view or update their system
            access.
          </p>
        </div>
      </div>

      {/* SPLIT VIEW LAYOUT */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* LEFT SIDE: User List Sidebar */}
        <div
          className="card"
          style={{ margin: 0, flex: "0 0 280px", padding: "14px" }}
        >
          <h4
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              borderBottom: "1px solid var(--line)",
              paddingBottom: "8px",
            }}
          >
            Team Members
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {safeUsers.map((u) => {
              const isSelected = u.username === selectedUsername;
              return (
                <div
                  key={u.username}
                  onClick={() => setSelectedUsername(u.username)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    background: isSelected
                      ? "linear-gradient(135deg, #eef2ff, #f5f3ff)"
                      : "transparent",
                    border: isSelected
                      ? "1px solid #6366f1"
                      : "1px solid transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: isSelected ? "bold" : "500",
                        fontSize: "13px",
                        color: "var(--text)",
                      }}
                    >
                      {u.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                      @{u.username}
                    </div>
                  </div>

                  <span
                    className={"user-status " + u.status.toLowerCase()}
                    style={{ padding: "3px 6px", fontSize: "9px" }}
                  >
                    {u.status}
                  </span>
                </div>
              );
            })}

            {safeUsers.length === 0 && (
              <div
                className="muted"
                style={{ textAlign: "center", padding: "20px" }}
              >
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Selected User Panel */}
        <div style={{ flex: "1 1 450px", minWidth: "280px" }}>
          {selectedUser ? (
            <UserEditor key={selectedUser.username} u={selectedUser} />
          ) : (
            <div
              className="card"
              style={{ margin: 0, textAlign: "center", padding: "50px 20px" }}
            >
              <p className="muted">No user selected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
