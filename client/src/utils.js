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
  ["isAdmin", "Admin (poora app control)"],
  ["canApprove", "Expense/Request approve kar sakta"],
  ["canViewLedger", "Ledger dekh sakta"],
  ["canAddIncome", "Income entry kar sakta"],
  ["canRequest", "Expense/Request bhej sakta"],
  ["canPurchase", "Kharidi / payment kar sakta"],
  ["canViewComplaints", "Complaint dekh sakta"],
  ["canRaiseComplaint", "Complaint raise kar sakta"],
  ["canResolve", "Complaint resolve kar sakta"],
  ["canViewActivity", "Activity log dekh sakta"],
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
