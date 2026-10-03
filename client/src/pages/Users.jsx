import { useState } from "react";
import { act, useFetch } from "../api";
import { PERMS } from "../utils";

function UserCard({ u }) {
  const [status, setStatus] = useState(u.status);
  const [pm, setPm] = useState(
    Object.fromEntries(PERMS.map((p) => [p[0], !!u[p[0]]])),
  );

  const save = () => act(`/users/${u.username}`, "PUT", { status, perms: pm });
  const reset = () => {
    const p = prompt("Naya password daalo (min 6) - " + u.username);
    if (p) act(`/users/${u.username}/reset-password`, "POST", { newPass: p });
  };

  return (
    <div className="card">
      <b>{u.name}</b> <span className="muted">({u.username})</span>
      <label>Status</label>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        {["Active", "Pending", "Disabled"].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {PERMS.map((p) => (
        <div className="perm" key={p[0]}>
          <input
            type="checkbox"
            checked={pm[p[0]]}
            onChange={(e) => setPm({ ...pm, [p[0]]: e.target.checked })}
          />
          <span>{p[1]}</span>
        </div>
      ))}
      <button className="btn sm" onClick={save}>
        💾 Save
      </button>
      <button className="btn sm gray" onClick={reset}>
        🔑 Password reset
      </button>
    </div>
  );
}

export default function Users() {
  const users = useFetch("/users");
  return (
    <>
      <div className="card">
        <h3>👥 Users aur Permissions</h3>
        <p className="muted">
          Naye signup "Pending" me aate hain. Status "Active" karke permissions
          tick karo aur Save dabao.
        </p>
      </div>
      {(users || []).map((u) => (
        <UserCard key={u.username} u={u} />
      ))}
    </>
  );
}
