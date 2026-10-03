import { useState } from "react";

import { act, toast } from "../api";
import { enablePush } from "../push";
import { PERMS } from "../utils";

export default function Profile({ me }) {
  const [o, setO] = useState("");
  const [n, setN] = useState("");

  const chPass = async () => {
    if (
      await act("/auth/change-password", "POST", {
        oldPass: o,
        newPass: n,
      })
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

  const myPerms = PERMS.filter((p) => me.perms[p[0]]).map((p) => p[1]);

  const initials = (me.name || "?").trim().charAt(0).toUpperCase();

  const role = me.perms?.isAdmin
    ? "Administrator"
    : me.perms?.canApprove
      ? "Partner"
      : "Staff";

  return (
    <div className="profile-page">
      {/* =====================================================
          PROFILE HEADER
      ===================================================== */}
      <div className="card profile-hero-card">
        <div className="profile-cover" />

        <div className="profile-main">
          <div className="profile-avatar">{initials}</div>

          <div className="profile-identity">
            <div className="profile-name-row">
              <h3>{me.name}</h3>

              <span className="profile-role">{role}</span>
            </div>

            <div className="profile-username">@{me.username}</div>
          </div>
        </div>

        <div className="profile-info-grid">
          <div className="profile-info-item">
            <span>Account</span>
            <strong>Active</strong>
          </div>

          <div className="profile-info-item">
            <span>Role</span>
            <strong>{role}</strong>
          </div>

          <div className="profile-info-item">
            <span>Permissions</span>
            <strong>{myPerms.length}</strong>
          </div>
        </div>
      </div>

      {/* =====================================================
          PERMISSIONS
      ===================================================== */}
      <div className="card profile-permission-card">
        <div className="profile-section-head">
          <div className="profile-section-icon permission-icon">🛡️</div>

          <div>
            <h3>Meri permissions</h3>

            <p>Aapke account ko diye gaye access</p>
          </div>
        </div>

        {myPerms.length > 0 ? (
          <div className="profile-permissions">
            {myPerms.map((perm, index) => (
              <div className="profile-permission" key={index}>
                <span className="permission-check">✓</span>

                <span>{perm}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="profile-no-permissions">
            <span>🔒</span>
            Koi permission assign nahi hai.
          </div>
        )}
      </div>

      {/* =====================================================
          NOTIFICATIONS
      ===================================================== */}
      <div className="card profile-notification-card">
        <div className="profile-section-head">
          <div className="profile-section-icon notification-icon">🔔</div>

          <div>
            <h3>Notifications</h3>

            <p>Request aur complaint alerts is device par paaiye.</p>
          </div>
        </div>

        <div className="notification-box">
          <div className="notification-box-icon">📱</div>

          <div className="notification-box-content">
            <strong>Device notifications</strong>

            <span>
              Har phone/browser par ek baar notifications enable karna hoga.
            </span>
          </div>
        </div>

        <div className="profile-actions">
          <button
            type="button"
            className="btn profile-primary-btn"
            onClick={push}
          >
            🔔 Notification chalu karo
          </button>

          <button
            type="button"
            className="btn gray profile-test-btn"
            onClick={test}
          >
            🧪 Test bhejo
          </button>
        </div>
      </div>

      {/* =====================================================
          PASSWORD
      ===================================================== */}
      <div className="card profile-password-card">
        <div className="profile-section-head">
          <div className="profile-section-icon password-icon">🔐</div>

          <div>
            <h3>Password badlo</h3>

            <p>Account security ke liye password update karein.</p>
          </div>
        </div>

        <div className="password-form">
          <div className="field-block">
            <label htmlFor="old-password">Purana password</label>

            <input
              id="old-password"
              type="password"
              value={o}
              onChange={(e) => setO(e.target.value)}
              placeholder="Purana password"
              autoComplete="current-password"
            />
          </div>

          <div className="field-block">
            <label htmlFor="new-password">
              Naya password
              <span className="field-help">Minimum 6 characters</span>
            </label>

            <input
              id="new-password"
              type="password"
              value={n}
              onChange={(e) => setN(e.target.value)}
              placeholder="Naya password"
              autoComplete="new-password"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn profile-password-btn"
              onClick={chPass}
            >
              🔐 Password badlo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
