const router = require("express").Router();
const bcrypt = require("bcryptjs");
const {
  User,
  Income,
  Source,
  Request,
  Complaint,
  nextCode,
  PERMS,
} = require("../models");
const {
  fail,
  h,
  perms,
  need,
  auth,
  notify,
  usersWith,
} = require("../middleware");

router.use(auth);

const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10); // IST
const str = (v) => String(v || "").trim();

// ---------- names + summary ----------
router.get(
  "/names",
  h(async (req, res) => {
    const us = await User.find({}, "username name").lean();
    res.json(Object.fromEntries(us.map((u) => [u.username, u.name])));
  }),
);

router.get(
  "/summary",
  h(async (req, res) => {
    const u = req.user,
      P = perms(u),
      out = { pendingForMe: 0, openComplaints: 0 };
    if (P.canApprove) {
      out.pendingForMe = await Request.countDocuments({
        status: "Pending",
        requestedBy: { $ne: u.username },
        "votes.user": { $ne: u.username },
      });
    }
    if (P.canViewComplaints)
      out.openComplaints = await Complaint.countDocuments({ status: "Open" });
    if (P.canViewLedger) {
      const [i, e] = await Promise.all([
        Income.aggregate([{ $group: { _id: null, t: { $sum: "$amount" } } }]),
        Request.aggregate([
          { $match: { status: "Purchased" } },
          { $group: { _id: null, t: { $sum: "$actualAmount" } } },
        ]),
      ]);
      out.balance = (i[0]?.t || 0) - (e[0]?.t || 0);
    }
    res.json(out);
  }),
);

// ---------- income + ledger ----------
router.get(
  "/sources",
  need("canAddIncome"),
  h(async (req, res) => {
    res.json((await Source.find().sort("name").lean()).map((s) => s.name));
  }),
);

router.post(
  "/income",
  need("canAddIncome", "Income entry ki permission nahi hai"),
  h(async (req, res) => {
    const amount = Number(req.body.amount),
      source = str(req.body.source),
      date = str(req.body.date);
    if (!(amount > 0)) throw fail("Amount sahi daalo");
    if (!source) throw fail("Source daalo");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail("Date sahi daalo");
    await Source.updateOne(
      { key: source.toLowerCase() },
      { $setOnInsert: { name: source, key: source.toLowerCase() } },
      { upsert: true },
    );
    await Income.create({
      date,
      source,
      amount,
      remark: str(req.body.remark),
      addedBy: req.user.username,
    });
    res.json({ message: "Income entry ho gayi" });
  }),
);

router.get(
  "/ledger",
  need("canViewLedger"),
  h(async (req, res) => {
    const [inc, exp] = await Promise.all([
      Income.find().lean(),
      Request.find({ status: "Purchased" }).lean(),
    ]);
    const rows = [
      ...inc.map((i) => ({
        date: i.date,
        type: "IN",
        title: i.source,
        remark: i.remark,
        by: i.addedBy,
        amt: i.amount,
        ts: i.createdAt,
      })),
      ...exp.map((r) => ({
        date: r.purchaseDate,
        type: "OUT",
        title: r.title,
        remark: r.purchaseNote || r.remark,
        by: r.purchasedBy,
        amt: r.actualAmount,
        ts: r.updatedAt,
      })),
    ].sort(
      (a, b) => a.date.localeCompare(b.date) || new Date(a.ts) - new Date(b.ts),
    );
    let bal = 0;
    rows.forEach((r) => {
      bal += r.type === "IN" ? r.amt : -r.amt;
      r.bal = bal;
    });
    res.json({ rows, balance: bal });
  }),
);

// ---------- requests (expense / item) ----------
async function eligible() {
  const us = await User.find(
    { status: "Active", $or: [{ isAdmin: true }, { canApprove: true }] },
    "username",
  ).lean();
  return us.map((u) => u.username);
}
function tally(r, elig) {
  const e = elig.filter((x) => x !== r.requestedBy);
  const n = e.length,
    needN = Math.floor(n / 2) + 1;
  const vs = (r.votes || []).filter((v) => e.includes(v.user));
  return {
    n,
    needN,
    vs,
    yes: vs.filter((v) => v.vote === "Y").length,
    no: vs.filter((v) => v.vote === "N").length,
  };
}
function serReq(r, elig, me, P) {
  const t = tally(r, elig);
  const mine = (r.votes || []).find((v) => v.user === me.username);
  return {
    id: r.code,
    type: r.type,
    title: r.title,
    amount: r.amount,
    remark: r.remark,
    requestedBy: r.requestedBy,
    date: r.date,
    status: r.status,
    purchasedBy: r.purchasedBy,
    purchaseDate: r.purchaseDate,
    actualAmount: r.actualAmount,
    purchaseNote: r.purchaseNote,
    n: t.n,
    need: t.needN,
    yes: t.yes,
    no: t.no,
    voters: t.vs.map((v) => ({ user: v.user, vote: v.vote })),
    myVote: mine ? mine.vote : "",
    canVote:
      P.canApprove && r.status === "Pending" && r.requestedBy !== me.username,
  };
}

router.get(
  "/requests",
  h(async (req, res) => {
    const P = perms(req.user);
    const seeAll =
      P.canApprove || P.canPurchase || P.canViewLedger || P.isAdmin;
    const q = seeAll ? {} : { requestedBy: req.user.username };
    const [list, elig] = await Promise.all([
      Request.find(q).sort({ createdAt: -1 }).lean(),
      eligible(),
    ]);
    res.json(list.map((r) => serReq(r, elig, req.user, P)));
  }),
);

router.post(
  "/requests",
  need("canRequest", "Request bhejne ki permission nahi hai"),
  h(async (req, res) => {
    const title = str(req.body.title),
      amount = Number(req.body.amount);
    if (!title) throw fail("Kis cheez ke liye? Title daalo");
    if (!(amount > 0)) throw fail("Amount (andaaza) daalo");
    const r = await Request.create({
      code: await nextCode("R-"),
      type: req.body.type === "Item" ? "Item" : "Expense",
      title,
      amount,
      remark: str(req.body.remark),
      requestedBy: req.user.username,
      date: today(),
    });
    const elig = (await eligible()).filter((x) => x !== req.user.username);
    notify(elig, {
      title: "💸 Naya request: approval chahiye",
      body: `${req.user.name} · ${title} · ₹${amount}`,
      url: "/#req",
    });
    res.json({
      message: "Request bhej di gayi, partner approval ka wait karein",
    });
  }),
);

router.post(
  "/requests/:code/vote",
  need("canApprove", "Approve karne ki permission nahi hai"),
  h(async (req, res) => {
    const r = await Request.findOne({ code: req.params.code });
    if (!r) throw fail("Request nahi mili", 404);
    if (r.status !== "Pending")
      throw fail("Is request par decision ho chuka hai");
    if (r.requestedBy === req.user.username)
      throw fail("Apni request ko khud approve nahi kar sakte");

    const v = req.body.vote === "Y" ? "Y" : "N";
    const old = r.votes.find((x) => x.user === req.user.username);
    if (old) {
      old.vote = v;
      old.date = new Date();
    } else r.votes.push({ user: req.user.username, vote: v });

    const t = tally(r, await eligible());
    if (t.yes >= t.needN) r.status = "Approved";
    else if (t.no > t.n - t.needN) r.status = "Rejected";
    await r.save();

    if (r.status === "Approved") {
      notify([r.requestedBy, ...(await usersWith("canPurchase"))], {
        title: "✅ Request approve ho gayi",
        body: `${r.code} · ${r.title} · ₹${r.amount}`,
        url: "/#req",
      });
    } else if (r.status === "Rejected") {
      notify([r.requestedBy], {
        title: "❌ Request reject ho gayi",
        body: `${r.code} · ${r.title}`,
        url: "/#req",
      });
    }
    res.json({ message: "Aapka vote darj ho gaya" });
  }),
);

router.post(
  "/requests/:code/purchase",
  need("canPurchase", "Kharidne/payment ki permission nahi hai"),
  h(async (req, res) => {
    const r = await Request.findOne({ code: req.params.code });
    if (!r) throw fail("Request nahi mili", 404);
    if (r.status !== "Approved")
      throw fail("Sirf approved request hi kharidi ja sakti hai");
    const amt = Number(req.body.amount);
    if (!(amt > 0)) throw fail("Asli kharcha amount daalo");
    Object.assign(r, {
      status: "Purchased",
      purchasedBy: req.user.username,
      purchaseDate: today(),
      actualAmount: amt,
      purchaseNote: str(req.body.note),
    });
    await r.save();
    notify([r.requestedBy], {
      title: "🛒 Kharid ho gaya",
      body: `${r.code} · ${r.title} · ₹${amt}`,
      url: "/#req",
    });
    res.json({ message: "Kharid mark ho gaya, ledger me kharcha chadh gaya" });
  }),
);

// ---------- complaints ----------
function prio(c) {
  if (c.status === "Resolved") return { label: "DONE", score: 0, hours: 0 };
  const hrs = (Date.now() - new Date(c.createdAt).getTime()) / 36e5;
  const m = {
    Main: ["EMERGENCY", 100],
    Village: ["HIGH", 90],
    Area: ["HIGH", 70],
    Single: hrs > 24 ? ["HIGH", 80] : ["NORMAL", 30],
  }[c.scope] || ["NORMAL", 20];
  return {
    label: m[0],
    score: m[1] + Math.min(hrs, 72) / 10,
    hours: Math.round(hrs),
  };
}

router.get(
  "/complaints",
  h(async (req, res) => {
    const P = perms(req.user);
    if (!P.canViewComplaints && !P.canRaiseComplaint)
      throw fail("Permission nahi hai", 403);
    const q = P.canViewComplaints ? {} : { raisedBy: req.user.username };
    const list = await Complaint.find(q).lean();
    const out = list
      .map((c) => {
        const p = prio(c);
        return {
          id: c.code,
          category: c.category,
          scope: c.scope,
          location: c.location,
          description: c.description,
          raisedBy: c.raisedBy,
          raised: c.createdAt,
          status: c.status,
          resolvedBy: c.resolvedBy,
          resolved: c.resolvedAt,
          note: c.note,
          prio: p.label,
          score: p.score,
          hours: p.hours,
        };
      })
      .sort(
        (a, b) =>
          (a.status === "Open" ? 0 : 1) - (b.status === "Open" ? 0 : 1) ||
          b.score - a.score ||
          new Date(b.resolved || 0) - new Date(a.resolved || 0),
      );
    res.json(out);
  }),
);

router.post(
  "/complaints",
  need("canRaiseComplaint", "Complaint raise karne ki permission nahi hai"),
  h(async (req, res) => {
    const description = str(req.body.description),
      location = str(req.body.location);
    if (!description) throw fail("Complaint ka detail likho");
    if (!location) throw fail("Location / customer / gaon ka naam likho");
    const scope = ["Single", "Area", "Village", "Main"].includes(req.body.scope)
      ? req.body.scope
      : "Single";
    const c = await Complaint.create({
      code: await nextCode("T-"),
      category: str(req.body.category) || "Other",
      scope,
      location,
      description,
      raisedBy: req.user.username,
    });
    const urgent = scope === "Main";
    notify(await usersWith("canResolve", [req.user.username]), {
      title:
        (urgent ? "🔴 EMERGENCY complaint " : "🎫 Nayi complaint ") + c.code,
      body: `${location} · ${description.slice(0, 80)}`,
      url: "/#cmp",
    });
    res.json({ message: "Ticket " + c.code + " ban gaya" });
  }),
);

router.post(
  "/complaints/:code/resolve",
  need("canResolve", "Resolve karne ki permission nahi hai"),
  h(async (req, res) => {
    const c = await Complaint.findOne({ code: req.params.code });
    if (!c) throw fail("Ticket nahi mila", 404);
    if (c.status === "Resolved") throw fail("Ye pehle se resolve hai");
    Object.assign(c, {
      status: "Resolved",
      resolvedBy: req.user.username,
      resolvedAt: new Date(),
      note: str(req.body.note),
    });
    await c.save();
    notify([c.raisedBy], {
      title: "✅ Complaint resolve ho gayi",
      body: `${c.code} · ${c.location}`,
      url: "/#cmp",
    });
    res.json({ message: "Ticket resolve ho gaya" });
  }),
);

// ---------- admin: users ----------
router.get(
  "/users",
  need("isAdmin", "Sirf Admin ye kar sakta hai"),
  h(async (req, res) => {
    const us = await User.find().sort("createdAt").lean();
    res.json(
      us.map((u) => {
        const o = { username: u.username, name: u.name, status: u.status };
        PERMS.forEach((k) => (o[k] = !!u[k]));
        return o;
      }),
    );
  }),
);

router.put(
  "/users/:username",
  need("isAdmin", "Sirf Admin ye kar sakta hai"),
  h(async (req, res) => {
    const t = await User.findOne({ username: req.params.username });
    if (!t) throw fail("User nahi mila", 404);
    const { status, perms: pp } = req.body;
    if (pp)
      PERMS.forEach((k) => {
        if (pp[k] !== undefined) t[k] = !!pp[k];
      });
    if (["Active", "Pending", "Disabled"].includes(status)) t.status = status;
    if (
      t.username === req.user.username &&
      (!t.isAdmin || t.status !== "Active")
    )
      throw fail("Apna Admin access ya status khud band nahi kar sakte");
    await t.save();
    res.json({ message: t.name + " ki settings save ho gayi" });
  }),
);

router.post(
  "/users/:username/reset-password",
  need("isAdmin", "Sirf Admin ye kar sakta hai"),
  h(async (req, res) => {
    const t = await User.findOne({ username: req.params.username });
    if (!t) throw fail("User nahi mila", 404);
    if (String(req.body.newPass || "").length < 6)
      throw fail("Password kam se kam 6 character ka ho");
    t.passHash = await bcrypt.hash(String(req.body.newPass), 10);
    await t.save();
    res.json({ message: t.name + " ka password reset ho gaya" });
  }),
);

// ---------- push ----------
router.get("/push/key", (req, res) =>
  res.json({ key: process.env.VAPID_PUBLIC || "" }),
);

router.post(
  "/push/subscribe",
  h(async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys) throw fail("Subscription sahi nahi hai");
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { pushSubs: { endpoint } } },
    );
    await User.updateOne(
      { _id: req.user._id },
      { $push: { pushSubs: { endpoint, keys } } },
    );
    res.json({ message: "Is phone par notification chalu ho gaya" });
  }),
);

router.post(
  "/push/test",
  h(async (req, res) => {
    await notify([req.user.username], {
      title: "🔔 Test notification",
      body: "Taratarini Vision notification sahi chal raha hai",
      url: "/",
    });
    res.json({ message: "Test notification bheja gaya" });
  }),
);

module.exports = router;
