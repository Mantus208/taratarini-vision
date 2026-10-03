import { useState } from "react";

import { api, setToken, toast } from "../api";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({});

  const set = (k) => (e) =>
    setF({
      ...f,
      [k]: e.target.value,
    });

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
    run(
      "/auth/login",
      {
        username: f.u,
        password: f.p,
      },
      (d) => {
        setToken(d.token);
        onLogin(d.user);
      },
    );

  const signup = () =>
    run(
      "/auth/signup",
      {
        name: f.n,
        username: f.u,
        password: f.p,
        answer: f.s,
      },
      (d) => {
        toast(d.message);
        switchTo("login");
      },
    );

  const forgot = () =>
    run(
      "/auth/forgot",
      {
        username: f.u,
        answer: f.s,
        newPass: f.p,
      },
      (d) => {
        toast(d.message);
        switchTo("login");
      },
    );

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  return (
    <div className="auth">
      <div className="auth-card">
        {/* ==================================================
            LEFT BRAND PANEL
        ================================================== */}
        <div className="auth-brand">
          <div className="auth-brand-glow glow-one" />
          <div className="auth-brand-glow glow-two" />

          <div className="auth-logo">🏢</div>

          <div className="auth-brand-title">Taratarini Vision</div>

          <div className="auth-brand-subtitle">OFFICE MANAGER</div>

          <div className="auth-brand-line" />

          <h1>
            Manage your office,
            <br />
            <span>your way.</span>
          </h1>

          <p className="auth-brand-description">
            Manage ledger, requests, complaints, and daily office activity in
            one place.
          </p>

          <div className="auth-features">
            <div className="auth-feature">
              <span>✓</span>
              <strong>Ledger management</strong>
            </div>

            <div className="auth-feature">
              <span>✓</span>
              <strong>Expense & requests</strong>
            </div>

            <div className="auth-feature">
              <span>✓</span>
              <strong>Complaint tracking</strong>
            </div>

            <div className="auth-feature">
              <span>✓</span>
              <strong>Activity monitoring</strong>
            </div>
          </div>

          <div className="auth-brand-footer">Secure • Simple • Organized</div>
        </div>

        {/* ==================================================
            RIGHT FORM
        ================================================== */}
        <div className="auth-form">
          {isLogin && (
            <>
              <div className="auth-form-top">
                <span className="auth-eyebrow">WELCOME BACK</span>

                <h2>Login to your account</h2>

                <p>Continue where you left off.</p>
              </div>

              <div className="auth-fields">
                <div className="auth-field">
                  <label htmlFor="login-username">Username</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">@</span>

                    <input
                      id="login-username"
                      value={f.u || ""}
                      onChange={set("u")}
                      autoCapitalize="off"
                      autoComplete="username"
                      placeholder="Enter username"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="login-password">Password</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🔒</span>

                    <input
                      id="login-password"
                      type="password"
                      value={f.p || ""}
                      onChange={set("p")}
                      autoComplete="current-password"
                      placeholder="Enter password"
                      onKeyDown={(e) => e.key === "Enter" && login()}
                    />
                  </div>
                </div>
              </div>

              <button type="button" className="auth-submit" onClick={login}>
                Login
                <span>→</span>
              </button>

              <div className="auth-links">
                <button type="button" onClick={() => switchTo("forgot")}>
                  Forgot password?
                </button>

                <span>|</span>

                <button type="button" onClick={() => switchTo("signup")}>
                  Create a new account
                </button>
              </div>
            </>
          )}

          {isSignup && (
            <>
              <div className="auth-form-top">
                <span className="auth-eyebrow">NEW ACCOUNT</span>

                <h2>Create your account</h2>

                <p>Admin approval is required after signup.</p>
              </div>

              <div className="auth-fields">
                <div className="auth-field">
                  <label htmlFor="signup-name">Full Name</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">👤</span>

                    <input
                      id="signup-name"
                      value={f.n || ""}
                      onChange={set("n")}
                      placeholder="Your full name"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-username">Username</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">@</span>

                    <input
                      id="signup-username"
                      value={f.u || ""}
                      onChange={set("u")}
                      autoCapitalize="off"
                      autoComplete="username"
                      placeholder="a-z, 0-9"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-password">Password</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🔒</span>

                    <input
                      id="signup-password"
                      type="password"
                      value={f.p || ""}
                      onChange={set("p")}
                      autoComplete="new-password"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-answer">Secret answer</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🔑</span>

                    <input
                      id="signup-answer"
                      value={f.s || ""}
                      onChange={set("s")}
                      placeholder="Your first school's name"
                    />
                  </div>

                  <small>
                    This answer will be used if you forget your password.
                  </small>
                </div>
              </div>

              <button type="button" className="auth-submit" onClick={signup}>
                Create account
                <span>→</span>
              </button>

              <div className="auth-back">
                <button type="button" onClick={() => switchTo("login")}>
                  ← Back to Login
                </button>
              </div>
            </>
          )}

          {isForgot && (
            <>
              <div className="auth-form-top">
                <span className="auth-eyebrow">ACCOUNT RECOVERY</span>

                <h2>Reset your password</h2>

                <p>Reset your password using your secret answer.</p>
              </div>

              <div className="auth-fields">
                <div className="auth-field">
                  <label htmlFor="forgot-username">Username</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">@</span>

                    <input
                      id="forgot-username"
                      value={f.u || ""}
                      onChange={set("u")}
                      autoCapitalize="off"
                      autoComplete="username"
                      placeholder="Your username"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="forgot-answer">Secret answer</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🔑</span>

                    <input
                      id="forgot-answer"
                      value={f.s || ""}
                      onChange={set("s")}
                      placeholder="Your first school's name"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="forgot-password">New Password</label>

                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">🔒</span>

                    <input
                      id="forgot-password"
                      type="password"
                      value={f.p || ""}
                      onChange={set("p")}
                      autoComplete="new-password"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>
              </div>

              <button type="button" className="auth-submit" onClick={forgot}>
                Change Password
                <span>→</span>
              </button>

              <div className="auth-recovery-note">
                💡 Don't remember your answer?
                <br />
                Ask the admin to reset your password.
              </div>

              <div className="auth-back">
                <button type="button" onClick={() => switchTo("login")}>
                  ← Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
