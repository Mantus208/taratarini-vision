import { useState } from "react";

import { act, useFetch } from "../api";

import { PERMS } from "../utils";

function UserCard({ u }) {
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
    const p = prompt("Naya password daalo (min 6) - " + u.username);

    if (p) {
      act(`/users/${u.username}/reset-password`, "POST", { newPass: p });
    }
  };

  return (
    <div className="card user-card">
      {/* USER HEADER */}
      <div className="user-card-head">
        <div>
          <h3 className="user-name">{u.name}</h3>

          <span className="muted">@{u.username}</span>
        </div>

        <span className={"user-status " + status.toLowerCase()}>{status}</span>
      </div>

      {/* STATUS */}
      <div className="field-block">
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
            <span>Is user ko kya-kya access dena hai</span>
          </div>
        </div>

        <div className="permissions">
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
          🔑 Password reset
        </button>
      </div>
    </div>
  );
}

export default function Users() {
  const users = useFetch("/users");

  return (
    <>
      <div className="card users-intro">
        <div className="intro-icon">👥</div>

        <div>
          <h3>Users aur Permissions</h3>

          <p className="muted">
            Naye signup "Pending" me aate hain. Status "Active" karke
            permissions tick karo aur Save dabao.
          </p>
        </div>
      </div>

      {(users || []).map((u) => (
        <UserCard key={u.username} u={u} />
      ))}
    </>
  );
}
