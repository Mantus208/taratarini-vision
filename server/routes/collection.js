const router = require("express").Router();

const { fail, h, need, auth } = require("../middleware");
const { logActivity, User } = require("../models");

const {
  Franchisee,
  StaffRate,
  PackagePrice,
  SubscriberPackage,
  PaytvBill,
  PaytvRecharge,
  SyncMeta,
} = require("../collectionModels");

const paytv = require("../paytv");

router.use(auth);

// =====================================================
// PEHLI BAAR KA DATA
// =====================================================
const SEED_FRANCHISEES = [
  ["10078", "BABA BELESWAR CABLE VISION", "MTAwNzg=", "BABAJI"],
  ["10047", "BASANTIA CABLE VISION", "MTAwNDc=", "DAKA"],
  ["10093", "GURUKRUPA CABLE", "MTAwOTM=", "DAKA"],
  ["10077", "HAPPY DIGITAL", "MTAwNzc=", "DAKA"],
  ["10023", "KAMESWAR VISION", "MTAwMjM=", "BUDHA"],
  ["10026", "KAPILESWAR CABLE VISION", "MTAwMjY=", "BUDHA"],
  ["10024", "MAA MANGALA CABLE VISION", "MTAwMjQ=", "MANTU"],
  ["10027", "NARAYANI CABLE VISION", "MTAwMjc=", "MANTU"],
  ["10021", "SAMRAJ CABLE VISION", "MTAwMjE=", "BUDHA"],
  ["10022", "SANJAYA VISION", "MTAwMjI=", "BABAJI"],
  ["10067", "SARATHI CABLE VISION", "MTAwNjc=", "BABAJI"],
  ["10025", "S K PRUTHIVI DARSHAN", "MTAwMjU=", "DAKA"],
  ["10094", "SAI DIGITAL", "MTAwOTQ=", "MANTU"],
];

const SEED_RATES = [
  ["MANTU", 15],
  ["BABAJI", 25],
  ["DAKA", 25],
  ["BUDHA", 25],
];

async function ensureSeed() {
  if (await SyncMeta.findById("seeded").lean()) return;
  try {
    if (!(await Franchisee.countDocuments())) {
      await Franchisee.insertMany(
        SEED_FRANCHISEES.map(([franchiseId, name, encodedId, staff]) => ({
          franchiseId,
          name,
          encodedId,
          staff,
        })),
      );
    }
    if (!(await StaffRate.countDocuments())) {
      await StaffRate.insertMany(
        SEED_RATES.map(([staff, commission]) => ({ staff, commission })),
      );
    }
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  await SyncMeta.updateOne(
    { _id: "seeded" },
    { $set: { value: true } },
    { upsert: true },
  );
}

// SubscriberPackage ka naya unique index (startIso ke saath). Purana index apne aap hat jata hai
let indexesReady = null;
function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = SubscriberPackage.syncIndexes().catch((e) =>
      console.error("[paytv] index sync fail:", e.message),
    );
  }
  return indexesReady;
}

// =====================================================
// HELPERS
// =====================================================
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayIST = () =>
  new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function range(q = {}) {
  const t = todayIST();
  const from = ISO.test(q.from) ? q.from : t.slice(0, 8) + "01";
  const to = ISO.test(q.to) ? q.to : t;
  if (from > to) throw fail("From date, To date se badi nahi ho sakti");
  return { from, to };
}

const zero = () => ({
  customers: 0,
  collection: 0,
  wallet: 0,
  commission: 0,
  net: 0,
  unpriced: 0,
});

const add = (a, b) => ({
  customers: a.customers + b.customers,
  collection: r2(a.collection + b.collection),
  wallet: r2(a.wallet + b.wallet),
  commission: r2(a.commission + b.commission),
  net: r2(a.net + b.net),
  unpriced: a.unpriced + b.unpriced,
});

const MON = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function isoOf(y, m, d) {
  const mo = Number(m);
  const da = Number(d);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}

// PayTV ki date (dd/mm/yyyy, dd-Mon-yyyy, yyyy-mm-dd, /Date(ms)/) -> yyyy-mm-dd
function parseDateIso(v) {
  const t = String(v ?? "").trim();
  if (!t) return "";
  let m = /^\/Date\((-?\d+)/.exec(t);
  if (m) return new Date(Number(m[1]) + 19800000).toISOString().slice(0, 10);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return isoOf(m[1], m[2], m[3]);
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t);
  if (m) return isoOf(m[3], m[2], m[1]);
  m = /^(\d{1,2})[\/\- ]([A-Za-z]{3})[A-Za-z]*[\/\-, ]+(\d{4})/.exec(t);
  if (m && MON[m[2].toLowerCase()])
    return isoOf(m[3], MON[m[2].toLowerCase()], m[1]);
  return "";
}

const cleanName = (v) =>
  String(v || "")
    .trim()
    .replace(/\s+/g, " ");
const normalizeName = (v) => cleanName(v).toUpperCase();

function normalizeType(value) {
  const raw = String(value || "").trim();
  const t = raw.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (!t) return "Other";
  if (t.includes("basic")) return "Basic";
  if (/add ?on/.test(t)) return "Addon";
  if (t.includes("channel")) return "Channel";
  if (t.includes("pack") || t.includes("bouquet")) return "Package";
  return raw;
}

const TYPE_RANK = { Basic: 1, Package: 2, Addon: 3, Channel: 4 };
const typeRank = (t) => TYPE_RANK[t] || 9;

const packageKey = (name, type) =>
  `${normalizeName(name)}|${normalizeType(type).toUpperCase()}`;

const upSub = (v) =>
  String(v || "")
    .trim()
    .toUpperCase();

function customerKey(franchiseId, subNo, fallback = "") {
  const sub = upSub(subNo);
  if (sub) return `${franchiseId}|${sub}`;
  return `${franchiseId}|BILL:${String(fallback || "").trim()}`;
}

// price tabhi "set" hai jab admin ne diya ho (0 bhi price hai: free)
const isSet = (p) =>
  !!p &&
  (p.priceSet === true ||
    (p.priceSet === undefined && Number(p.customerPrice) > 0));

// package ka price naam se dhundte hain (type badle to bhi price na khoye)
function buildPriceMap(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = normalizeName(r.name);
    const cur = map.get(k);
    if (!cur || (!isSet(cur) && isSet(r))) map.set(k, r);
  }
  return map;
}

// Actual recharge = PayTV ne jo kata (Out) - jo wapas mila (In)
function buildRechargeMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const subNo = upSub(row.subNo);
    if (!subNo) continue;
    const key = customerKey(row.franchiseId, subNo);
    map.set(
      key,
      (map.get(key) || 0) +
        (Number(row.outAmount) || 0) -
        (Number(row.inAmount) || 0),
    );
  }
  for (const [k, v] of map) map.set(k, r2(v));
  return map;
}

function buildPackageMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.active === false) continue;
    const subNo = upSub(row.subNo);
    if (!subNo) continue;
    const key = customerKey(row.franchiseId, subNo);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

// package us range ka hai jab uski start date range ke andar ho (date na mile to maan lo)
const inPeriod = (p, from, to) =>
  !p.startIso || (p.startIso >= from && p.startIso <= to);

function calculateCustomer(
  bill,
  comm,
  pkgMap,
  priceMap,
  rechargeMap,
  from,
  to,
) {
  const key = customerKey(bill.franchiseId, bill.subNo, bill.billNo);
  const rows = (pkgMap.get(key) || [])
    .filter((p) => inPeriod(p, from, to))
    .sort(
      (a, b) =>
        typeRank(normalizeType(a.type)) - typeRank(normalizeType(b.type)) ||
        String(a.name).localeCompare(String(b.name)),
    );

  let customerPrice = 0;
  const packages = [];
  const missingPackages = [];

  for (const sp of rows) {
    const type = normalizeType(sp.type);
    const pp = priceMap.get(normalizeName(sp.name));
    const configured = isSet(pp);
    const price = configured ? Number(pp.customerPrice) || 0 : 0;
    if (!configured) missingPackages.push({ name: sp.name, type });
    customerPrice += price;
    packages.push({
      name: sp.name,
      type,
      paytvPrice: Number(sp.paytvPrice) || 0,
      customerPrice: price,
      configured,
      startDate: sp.startIso || "",
    });
  }

  // commission sirf tab jab is range me Basic package ho
  const hasBasic = packages.some((p) => p.type === "Basic");

  return {
    packages,
    hasBasic,
    customerPrice: r2(customerPrice),
    commission: hasBasic ? comm : 0,
    actualRecharge: r2(
      rechargeMap.get(customerKey(bill.franchiseId, bill.subNo)) || 0,
    ),
    missingPackages,
    noPackage: packages.length === 0,
    priced: packages.length > 0 && missingPackages.length === 0,
  };
}

function uniqueCustomerBills(bills) {
  const map = new Map();
  for (const b of bills) {
    const key = customerKey(b.franchiseId, b.subNo, b.billNo);
    const existing = map.get(key);
    if (!existing || String(b.date || "") >= String(existing.date || "")) {
      map.set(key, b);
    }
  }
  return [...map.values()];
}

// =====================================================
// LOAD
// =====================================================
async function load(from, to, franchiseId) {
  await ensureSeed();
  await ensureIndexes();

  const q = { date: { $gte: from, $lte: to } };
  if (franchiseId) q.franchiseId = franchiseId;

  const [frs, rates, prices, bills, rechargeRows] = await Promise.all([
    Franchisee.find().sort("name").lean(),
    StaffRate.find().lean(),
    PackagePrice.find().lean(),
    PaytvBill.find(q).sort({ date: 1, billNo: 1 }).lean(),
    PaytvRecharge.find(q).lean(),
  ]);

  const rate = new Map(rates.map((r) => [r.staff, Number(r.commission) || 0]));

  const subNos = [...new Set(bills.map((b) => upSub(b.subNo)).filter(Boolean))];
  const pq = { active: { $ne: false }, subNo: { $in: subNos } };
  if (franchiseId) pq.franchiseId = franchiseId;
  const subscriberPackages = subNos.length
    ? await SubscriberPackage.find(pq).lean()
    : [];

  return {
    frs,
    rates,
    rate,
    priceMap: buildPriceMap(prices),
    packageMap: buildPackageMap(subscriberPackages),
    rechargeMap: buildRechargeMap(rechargeRows),
    bills,
  };
}

// =====================================================
// STAFF-WISE SUMMARY
// =====================================================
router.get(
  "/summary",
  need("canViewLedger"),
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const { frs, rates, rate, priceMap, packageMap, rechargeMap, bills } =
      await load(from, to);

    const meta = await SyncMeta.findById("lastSync").lean();
    const last = meta ? meta.value : null;

    // last sync me jo naye package mile aur jinka price abhi bhi set nahi
    const newKeys = new Set(
      ((last && last.newPackages) || [])
        .filter((p) => !isSet(priceMap.get(normalizeName(p.name))))
        .map((p) => normalizeName(p.name)),
    );

    const stat = new Map(
      frs.map((f) => [
        f.franchiseId,
        // 👇 YAHAN hiddenFrom JOD DIYA HAI
        {
          franchiseId: f.franchiseId,
          name: f.name,
          hiddenFrom: f.hiddenFrom || "",
          ...zero(),
        },
      ]),
    );
    const staffOf = new Map(frs.map((f) => [f.franchiseId, f.staff]));
    const missing = new Map();
    let noPackage = 0;

    for (const b of uniqueCustomerBills(bills)) {
      const s = stat.get(b.franchiseId);
      if (!s) continue;

      const comm = Number(rate.get(staffOf.get(b.franchiseId))) || 0;
      const info = calculateCustomer(
        b,
        comm,
        packageMap,
        priceMap,
        rechargeMap,
        from,
        to,
      );

      s.customers++;
      s.collection += info.customerPrice;
      s.wallet += info.actualRecharge;
      s.commission += info.commission;

      if (!info.priced) {
        s.unpriced++;
        if (info.noPackage) noPackage++;
        for (const mp of info.missingPackages) {
          const k = normalizeName(mp.name);
          if (!missing.has(k)) {
            missing.set(k, {
              name: mp.name,
              type: mp.type,
              customers: 0,
              isNew: newKeys.has(k),
            });
          }
          missing.get(k).customers++;
        }
      }
    }

    for (const s of stat.values()) {
      s.collection = r2(s.collection);
      s.wallet = r2(s.wallet);
      s.commission = r2(s.commission);
      s.net = r2(s.collection - s.wallet - s.commission);
    }

    const names = [
      ...new Set([
        ...rates.map((r) => r.staff),
        ...frs.map((f) => f.staff || "UNASSIGNED"),
      ]),
    ];

    const staff = names
      .map((name) => {
        const list = frs
          .filter((f) => (f.staff || "UNASSIGNED") === name)
          .map((f) => stat.get(f.franchiseId));
        return {
          name,
          rate: rate.get(name) || 0,
          franchisees: list,
          totals: list.reduce(add, zero()),
        };
      })
      .filter((s) => s.franchisees.length);

    const totals = staff.reduce((a, s) => add(a, s.totals), zero());

    res.json({
      from,
      to,
      staff,
      totals,
      unpriced: totals.unpriced,
      noPackage,
      unpricedPackages: [...missing.values()].sort(
        (a, b) =>
          Number(b.isNew) - Number(a.isNew) || b.customers - a.customers,
      ),
      last,
    });
  }),
);

// =====================================================
// EK FRANCHISEE KE CUSTOMERS (sirf chuni hui range ke bills / packages)
// =====================================================
router.get(
  "/franchisee/:id",
  need("canViewLedger"),
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const { frs, rate, priceMap, packageMap, rechargeMap, bills } = await load(
      from,
      to,
      req.params.id,
    );

    const f = frs.find((x) => x.franchiseId === req.params.id);
    if (!f) throw fail("Franchisee nahi mila", 404);

    const comm = rate.get(f.staff) || 0;

    const rows = uniqueCustomerBills(bills).map((b) => {
      const info = calculateCustomer(
        b,
        comm,
        packageMap,
        priceMap,
        rechargeMap,
        from,
        to,
      );
      return {
        billNo: b.billNo,
        subNo: b.subNo,
        subscriber: b.subscriber,
        date: b.date,
        packages: info.packages,
        hasBasic: info.hasBasic,
        noPackage: info.noPackage,
        priced: info.priced,
        price: info.customerPrice,
        commission: info.commission,
        recharge: info.actualRecharge,
        balance: r2(info.customerPrice - info.commission - info.actualRecharge),
      };
    });

    res.json({
      franchisee: {
        franchiseId: f.franchiseId,
        name: f.name,
        staff: f.staff,
        commission: comm,
      },
      from,
      to,
      rows,
    });
  }),
);

// =====================================================
// SETTINGS
// =====================================================
router.get(
  "/settings",
  need("isAdmin", "Sirf Admin ye kar sakta hai"),
  h(async (req, res) => {
    await ensureSeed();
    await ensureIndexes();

    const [fr, rates, saved, found, allUsers] = await Promise.all([
      Franchisee.find().sort("name").lean(),
      StaffRate.find().sort("staff").lean(),
      PackagePrice.find().lean(),
      // sirf wahi package jo sync hue customers par mile
      SubscriberPackage.aggregate([
        { $match: { active: { $ne: false } } },
        {
          $group: {
            _id: { name: "$name", type: "$type" },
            subs: { $addToSet: { $concat: ["$franchiseId", "|", "$subNo"] } },
            paytvPrice: { $max: "$paytvPrice" },
          },
        },
        { $project: { customers: { $size: "$subs" }, paytvPrice: 1 } },
      ]),
      User.find().lean(), // 👈 Nayi line ekdum last (5th number) par
    ]);

    const list = new Map();
    for (const p of saved) {
      list.set(packageKey(p.name, p.type), {
        name: p.name,
        type: normalizeType(p.type),
        customerPrice: Number(p.customerPrice) || 0,
        priceSet: isSet(p),
        customers: 0,
        paytvPrice: 0,
      });
    }
    for (const g of found) {
      const type = normalizeType(g._id.type);
      const key = packageKey(g._id.name, type);
      const cur = list.get(key) || {
        name: g._id.name,
        type,
        customerPrice: 0,
        priceSet: false,
        customers: 0,
        paytvPrice: 0,
      };
      cur.customers = g.customers;
      cur.paytvPrice = Number(g.paytvPrice) || 0;
      list.set(key, cur);
    }

    res.json({
      franchisees: fr.map((f) => ({
        franchiseId: f.franchiseId,
        name: f.name,
        staff: f.staff,
        hiddenFrom: f.hiddenFrom || "",
      })),
      rates: rates.map((r) => ({ staff: r.staff, commission: r.commission })),
      packagePrices: [...list.values()].sort(
        (a, b) =>
          typeRank(a.type) - typeRank(b.type) || a.name.localeCompare(b.name),
      ),
      paytv: { configured: paytv.configured(), base: paytv.BASE },
      systemUsers: allUsers
        .map((u) =>
          String(u.name || "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    });
  }),
);

router.put(
  "/settings",
  need("isAdmin", "Sirf Admin ye kar sakta hai"),
  h(async (req, res) => {
    const b = req.body || {};

    const rates = new Map();
    for (const r of Array.isArray(b.rates) ? b.rates : []) {
      const staff = String(r.staff || "")
        .trim()
        .toUpperCase();
      const commission = Number(r.commission);
      if (staff && Number.isFinite(commission) && commission >= 0) {
        rates.set(staff, commission);
      }
    }

    for (const f of Array.isArray(b.franchisees) ? b.franchisees : []) {
      const staff = String(f.staff || "")
        .trim()
        .toUpperCase();
      const hiddenFrom = String(f.hiddenFrom || "")
        .trim()
        .toUpperCase(); // 👈 NAYI LINE

      await Franchisee.updateOne(
        { franchiseId: String(f.franchiseId) },
        { $set: { staff, hiddenFrom } }, // 👈 YAHAN BHI ADD KIYA
      );
    }

    await StaffRate.deleteMany({});
    if (rates.size) {
      await StaffRate.insertMany(
        [...rates].map(([staff, commission]) => ({ staff, commission })),
      );
    }

    // packagePrices na aaye to purane prices ko chhedte nahi
    if (Array.isArray(b.packagePrices)) {
      const ops = [];
      for (const p of b.packagePrices) {
        const name = cleanName(p.name);
        const type = normalizeType(p.type);
        if (!name) continue;

        if (p.remove) {
          ops.push({ deleteOne: { filter: { name, type } } });
          continue;
        }

        const raw = p.customerPrice;
        const num =
          raw === "" || raw === null || raw === undefined ? NaN : Number(raw);
        const set = Number.isFinite(num) && num >= 0;

        ops.push({
          updateOne: {
            filter: { name, type },
            update: {
              $set: {
                customerPrice: set ? num : 0,
                priceSet: set,
                active: true,
              },
            },
            upsert: true,
          },
        });
      }
      if (ops.length) await PackagePrice.bulkWrite(ops, { ordered: false });
    }

    logActivity(
      "user",
      req.user.username,
      "Village Collection settings badli (staff / commission / package prices)",
    );
    res.json({ message: "Settings save ho gayi" });
  }),
);

// =====================================================
// ek subscriber ki recharge entries (jaanch ke liye)
// =====================================================
router.get(
  "/recharge/:subNo",
  need("canViewLedger"),
  h(async (req, res) => {
    const { from, to } = range(req.query);
    const q = {
      subNo: upSub(req.params.subNo),
      date: { $gte: from, $lte: to },
    };
    if (req.query.franchiseId) q.franchiseId = String(req.query.franchiseId);

    const rows = await PaytvRecharge.find(q).sort({ tranTime: 1 }).lean();
    const totalOut = rows.reduce((a, x) => a + (Number(x.outAmount) || 0), 0);
    const totalIn = rows.reduce((a, x) => a + (Number(x.inAmount) || 0), 0);

    res.json({
      subNo: upSub(req.params.subNo),
      from,
      to,
      rows,
      totalOut: r2(totalOut),
      totalIn: r2(totalIn),
      actualRecharge: r2(totalOut - totalIn),
    });
  }),
);

// =====================================================
// PAYTV SYNC
// har franchisee ke 3 kaam alag-alag: bills, recharge ledger, packages
// =====================================================
let job = {
  running: false,
  startedAt: null,
  finishedAt: null,
  progress: null,
  log: [],
  issues: [],
  result: null,
};

async function saveRecharge(f, rows, from, to) {
  const keys = rows.map((r) => r.key);

  await PaytvRecharge.deleteMany({
    franchiseId: f.franchiseId,
    date: { $gte: from, $lte: to },
    key: { $nin: keys },
  });

  if (rows.length) {
    await PaytvRecharge.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { key: r.key },
          update: { $set: r },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
}

async function savePackages(f, result, from, existing, newPkgs) {
  const now = new Date();
  const uniq = new Map();
  let noDate = 0;

  for (const p of result.rows) {
    const subNo = upSub(p.subNo);
    const name = cleanName(p.name);
    if (!subNo || !name) continue;
    const type = normalizeType(p.type);
    const startIso = parseDateIso(p.startDate) || parseDateIso(p.startDateAlt);
    if (!startIso) noDate++;
    uniq.set(`${subNo}|${packageKey(name, type)}|${startIso}`, {
      subNo,
      name,
      type,
      startIso,
      p,
    });
  }

  // jo ab PayTV par nahi dikhte (withdraw / deactivate) unhe inactive karo.
  // Is sync ki range se pehle ke purane records ko haath nahi lagate (unka hisaab bana rahe)
  if (result.okSubs.length) {
    await SubscriberPackage.updateMany(
      {
        franchiseId: f.franchiseId,
        subNo: { $in: result.okSubs.map(upSub) },
        $or: [{ startIso: "" }, { startIso: { $gte: from } }],
      },
      { $set: { active: false } },
    );
  }

  if (!uniq.size) return { saved: 0, noDate };

  await SubscriberPackage.bulkWrite(
    [...uniq.values()].map(({ subNo, name, type, startIso, p }) => ({
      updateOne: {
        filter: { franchiseId: f.franchiseId, subNo, name, type, startIso },
        update: {
          $set: {
            subscriber: p.subscriber || "",
            paytvPrice: Number(p.paytvPrice) || 0,
            paytvPackageId: String(p.paytvPackageId || ""),
            startDate: p.startDate || "",
            active: true,
            lastSyncAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  // naya package mile to uska price-record banao (price baaki)
  const ops = [];
  const seen = new Set();
  for (const { name, type } of uniq.values()) {
    const k = packageKey(name, type);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!existing.has(k)) {
      existing.add(k);
      newPkgs.set(k, { name, type });
    }
    ops.push({
      updateOne: {
        filter: { name, type },
        update: {
          $setOnInsert: { customerPrice: 0, priceSet: false, active: true },
        },
        upsert: true,
      },
    });
  }
  if (ops.length) await PackagePrice.bulkWrite(ops, { ordered: false });

  return { saved: uniq.size, noDate };
}

async function runSync(from, to) {
  job = {
    running: true,
    startedAt: new Date(),
    finishedAt: null,
    progress: { done: 0, total: 0, name: "" },
    log: [],
    issues: [],
    result: null,
  };

  const say = (m) => {
    job.log.push(m);
    if (job.log.length > 400) job.log.shift();
    console.log("[paytv]", m);
    if (/^(⚠|✘)/.test(m) && job.issues.length < 40) {
      job.issues.push(m.replace(/^(⚠|✘)\s*/, ""));
    }
  };

  try {
    await ensureSeed();
    await ensureIndexes();

    // purane version ke package records (start date ke bina) hatao, ab sahi se dobara aayenge
    await SubscriberPackage.deleteMany({ startIso: { $exists: false } });

    const frs = await Franchisee.find().sort("name").lean();
    const existing = new Set(
      (await PackagePrice.find().lean()).map((p) => packageKey(p.name, p.type)),
    );
    const newPkgs = new Map();

    const session = await paytv.login(say);
    job.progress.total = frs.length;

    let total = 0;
    let rechargeTotal = 0;
    let pkgTotal = 0;
    let noDate = 0;
    let failed = 0;

    for (const f of frs) {
      job.progress.name = f.name;
      say(`── ${f.name}`);
      let billRows = null;
      try {
        // NAYI LINE YAHAN ADD KI HAI: Har data fetch se pehle franchisee ko switch karein
        await paytv.switchTo(session, f);
      } catch (e) {
        failed++;
        say(`✘ ${f.name} · switch failed: ${e.message}`);
        continue; // Agar switch fail ho jaye to aage ka fetch mat karo
      }
      // 1) BILLS
      try {
        const rows = await paytv.fetchBills(session, f, from, to);
        await PaytvBill.deleteMany({
          franchiseId: f.franchiseId,
          date: { $gte: from, $lte: to },
        });
        if (rows.length) {
          await PaytvBill.insertMany(
            rows.map((r) => ({ ...r, franchiseId: f.franchiseId })),
          );
        }
        billRows = rows;
        total += rows.length;
        say(`✔ bills: ${rows.length}`);
      } catch (e) {
        failed++;
        say(`✘ ${f.name} · bills: ${e.message}`);
      }

      // 2) RECHARGE LEDGER
      try {
        const rows = await paytv.fetchRechargeLedger(session, f, from, to, say);
        await saveRecharge(f, rows, from, to);
        rechargeTotal += rows.length;
        say(`✔ recharge ledger: ${rows.length} rows`);
      } catch (e) {
        failed++;
        say(`✘ ${f.name} · recharge ledger: ${e.message}`);
      }

      // 3) PACKAGES
      try {
        const list =
          billRows ||
          (await PaytvBill.find({
            franchiseId: f.franchiseId,
            date: { $gte: from, $lte: to },
          }).lean());

        const result = await paytv.fetchSubscriberPackages(
          session,
          f,
          list,
          from,
          to,
          say,
        );
        const r = await savePackages(f, result, from, existing, newPkgs);
        pkgTotal += r.saved;
        noDate += r.noDate;
        say(
          `✔ packages: ${result.okSubs.length} subscribers, ${r.saved} records`,
        );
      } catch (e) {
        failed++;
        say(`✘ ${f.name} · packages: ${e.message}`);
      }

      job.progress.done++;
    }

    if (noDate) {
      job.issues.push(
        `${noDate} package ki start date samajh nahi aayi, un par mahine ka filter nahi lagega`,
      );
    }

    job.result = {
      ok: failed === 0,
      total,
      rechargeTotal,
      packages: pkgTotal,
      failed,
      from,
      to,
      newPackages: [...newPkgs.values()].slice(0, 60),
      issues: job.issues.slice(0, 30),
    };

    await SyncMeta.updateOne(
      { _id: "lastSync" },
      { $set: { value: { at: new Date(), ...job.result } } },
      { upsert: true },
    );
  } catch (e) {
    job.result = {
      ok: false,
      error: e.message,
      total: 0,
      rechargeTotal: 0,
      packages: 0,
      failed: 0,
      from,
      to,
      newPackages: [],
      issues: [e.message],
    };
    say("✘ " + e.message);
  } finally {
    job.running = false;
    job.finishedAt = new Date();
  }
}

router.post(
  "/sync",
  need("isAdmin", "Sirf Admin ye kar sakta hai"),
  h(async (req, res) => {
    if (job.running) {
      return res.json({
        started: false,
        message: "Sync pehle se chal raha hai",
      });
    }

    const t = todayIST();
    const from = ISO.test(req.body && req.body.from)
      ? req.body.from
      : t.slice(0, 8) + "01";
    const to = ISO.test(req.body && req.body.to) ? req.body.to : t;
    if (from > to) throw fail("From date, To date se badi nahi ho sakti");

    logActivity(
      "user",
      req.user.username,
      `PayTV sync shuru kiya (${from} se ${to})`,
    );

    runSync(from, to);

    res.json({
      started: true,
      message: "Sync shuru ho gaya, thodi der lagegi",
    });
  }),
);

router.get(
  "/sync/status",
  need("canViewLedger"),
  h(async (req, res) => {
    const meta = await SyncMeta.findById("lastSync").lean();
    res.json({
      running: job.running,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      progress: job.progress,
      issues: req.user.isAdmin ? job.issues : [],
      result: job.result,
      last: meta ? meta.value : null,
      configured: paytv.configured(),
    });
  }),
);

// =====================================================
// AUTO SYNC (optional)
// =====================================================
const AUTO = Number(process.env.PAYTV_AUTO_SYNC_MIN || 0);
if (AUTO > 0 && paytv.configured()) {
  setInterval(
    () => {
      if (job.running) return;
      const t = todayIST();
      runSync(t.slice(0, 8) + "01", t);
    },
    AUTO * 60 * 1000,
  );
}

module.exports = router;
