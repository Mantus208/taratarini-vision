export const NAMES = {};
export const nm = (u) => NAMES[u] || u;
export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const fday = (s) => {
  if (!s) return "";
  const p = s.split("-");
  return p[2] + "-" + p[1] + "-" + p[0];
};
export const fdt = (s) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
export const today = () =>
  new Date(Date.now() + 19800000).toISOString().slice(0, 10);

export const PERMS = [
  ["isAdmin", "Admin (full app control)"],
  ["canApprove", "Can approve expenses/requests"],
  ["canViewLedger", "Can view ledger"],
  ["canAddIncome", "Can add income entries"],
  ["canRequest", "Can submit expenses/requests"],
  ["canPurchase", "Can make purchases/payments"],
  ["canViewComplaints", "Can view complaints"],
  ["canRaiseComplaint", "Can raise complaints"],
  ["canResolve", "Can resolve complaints"],
  ["canViewActivity", "Can view activity log"],
];

// activity log ke icon aur filter group
export const ACT_ICON = {
  income: "💰",
  request: "💸",
  vote: "🗳️",
  purchase: "🛒",
  complaint: "🎫",
  resolve: "✅",
  user: "👥",
  auth: "🔐",
};
export const ACT_GROUP = {
  income: "income",
  request: "request",
  vote: "request",
  purchase: "request",
  complaint: "complaint",
  resolve: "complaint",
  user: "user",
  auth: "user",
};
