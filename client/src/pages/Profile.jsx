import { useState } from "react";
import { act, api, toast } from "../api";
import { enablePush } from "../push";
import { PERMS } from "../utils";

export default function Profile({ me }) {
  const [o, setO] = useState("");
  const [n, setN] = useState("");

  const chPass = async () => {
    if (
      await act("/auth/change-password", "POST", { oldPass: o, newPass: n })
    ) {
      setO("");
      setN("");
    }
  };
  const push = async () => {
    try {
      await enablePush();
      toast("Is phone par notification chalu ho gaya");
    } catch (e) {
      toast(e.message, true);
    }
  };
  const test = () => act("/push/test", "POST");

  const myPerms = PERMS.filter((p) => me.perms[p[0]])
    .map((p) => p[1])
    .join(" · ");

  return (
    <>
      <div className="card">
        <h3>👤 Mera Profile</h3>
        <p>
          <b>{me.name}</b>
          <br />
          <span className="muted">Username: {me.username}</span>
        </p>
        <p className="muted">Meri permissions: {myPerms || "Koi nahi"}</p>
      </div>
      <div className="card">
        <h3>🔔 Notification</h3>
        <p className="muted">
          Isse is phone par request/complaint ka alert seedha aayega. Har
          phone/browser par ek baar chalu karna hoga.
        </p>
        <button className="btn" onClick={push}>
          Notification chalu karo
        </button>{" "}
        <button className="btn gray" onClick={test}>
          Test bhejo
        </button>
      </div>
      <div className="card">
        <h3>🔑 Password badlo</h3>
        <label>Purana password</label>
        <input
          type="password"
          value={o}
          onChange={(e) => setO(e.target.value)}
        />
        <label>Naya password (min 6)</label>
        <input
          type="password"
          value={n}
          onChange={(e) => setN(e.target.value)}
        />
        <button className="btn" onClick={chPass}>
          Password badlo
        </button>
      </div>
    </>
  );
}
