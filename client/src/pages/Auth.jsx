import { useState } from "react";
import { api, setToken, toast } from "../api";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const switchTo = (m) => {
    setMode(m);
    setF({});
  };

  const run = async (path, body, after) => {
    try {
      after(await api(path, "POST", body));
    } catch (e) {
      toast(e.message, true);
    }
  };
  const login = () =>
    run("/auth/login", { username: f.u, password: f.p }, (d) => {
      setToken(d.token);
      onLogin(d.user);
    });
  const signup = () =>
    run(
      "/auth/signup",
      { name: f.n, username: f.u, password: f.p, answer: f.s },
      (d) => {
        toast(d.message);
        switchTo("login");
      },
    );
  const forgot = () =>
    run("/auth/forgot", { username: f.u, answer: f.s, newPass: f.p }, (d) => {
      toast(d.message);
      switchTo("login");
    });

  return (
    <div className="auth">
      <div className="card">
        {mode === "login" && (
          <>
            <h3>🏢 Taratarini Vision - Login</h3>
            <label>Username</label>
            <input value={f.u || ""} onChange={set("u")} autoCapitalize="off" />
            <label>Password</label>
            <input
              type="password"
              value={f.p || ""}
              onChange={set("p")}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            <button className="btn" onClick={login}>
              Login
            </button>
            <p>
              <span className="link" onClick={() => switchTo("forgot")}>
                Password bhul gaye?
              </span>{" "}
              &nbsp;|&nbsp;{" "}
              <span className="link" onClick={() => switchTo("signup")}>
                Naya user signup
              </span>
            </p>
          </>
        )}
        {mode === "signup" && (
          <>
            <h3>Naya User Signup</h3>
            <label>Poora naam</label>
            <input value={f.n || ""} onChange={set("n")} />
            <label>Username (a-z, 0-9)</label>
            <input value={f.u || ""} onChange={set("u")} autoCapitalize="off" />
            <label>Password (min 6)</label>
            <input type="password" value={f.p || ""} onChange={set("p")} />
            <label>
              Secret answer: Aapke pehle school ka naam? (password bhulne par
              kaam aayega)
            </label>
            <input value={f.s || ""} onChange={set("s")} />
            <button className="btn" onClick={signup}>
              Signup
            </button>
            <p>
              <span className="link" onClick={() => switchTo("login")}>
                ← Login par wapas
              </span>
            </p>
          </>
        )}
        {mode === "forgot" && (
          <>
            <h3>Password Reset</h3>
            <label>Username</label>
            <input value={f.u || ""} onChange={set("u")} autoCapitalize="off" />
            <label>Secret answer (pehle school ka naam)</label>
            <input value={f.s || ""} onChange={set("s")} />
            <label>Naya password (min 6)</label>
            <input type="password" value={f.p || ""} onChange={set("p")} />
            <button className="btn" onClick={forgot}>
              Password badlo
            </button>
            <p className="muted">
              Answer yaad nahi? Admin se password reset karwao.
            </p>
            <p>
              <span className="link" onClick={() => switchTo("login")}>
                ← Login par wapas
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
