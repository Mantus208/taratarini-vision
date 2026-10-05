const XLSX = require("xlsx");
const crypto = require("crypto");
const cheerio = require("cheerio");

const BASE = (process.env.PAYTV_BASE || "http://117.242.149.73").replace(
  /\/+$/,
  "",
);
const USER = () => process.env.PAYTV_USERNAME || process.env.PAYTV_USER || "";
const PASS = () => process.env.PAYTV_PASSWORD || process.env.PAYTV_PASS || "";
const configured = () => !!(USER() && PASS());

// package page ka rasta (har sync ke shuru me reset hota hai)
let hwBroken = false;
let hwOkAny = false;

// ---------- date helpers ----------
const MONTHS = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};
const toIso = (s) => {
  const m = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/.exec(s);
  return m && MONTHS[m[2]]
    ? `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`
    : "";
};
const toDmy = (iso) => iso.split("-").reverse().join("/");

// ---------- SESSION CACHE (ANTI-BLOCK SYSTEM) ----------
let cachedSession = null;
let lastLoginTime = 0;
const SESSION_TIMEOUT = 25 * 60 * 1000; // 25 minutes tak purana login valid rahega (safe zone)

// ---------- cookie wala chhota session ----------
class Session {
  constructor() {
    this.jar = new Map();
  }
  keep(res) {
    const list =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [];
    for (const c of list) {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      if (i > 0) this.jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
  }
  cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async send(path, opt = {}, asBuffer = false) {
    let url = /^https?:/i.test(path) ? path : BASE + path;
    let method = opt.method || "GET";
    let body = opt.form ? new URLSearchParams(opt.form).toString() : undefined;
    for (let i = 0; i < 8; i++) {
      const headers = {
        Cookie: this.cookie(),
        "User-Agent": "Mozilla/5.0 (compatible; TaratariniOffice/1.0)",
        ...(opt.headers || {}),
      };
      if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
      if (opt.referer) headers.Referer = opt.referer;
      const res = await fetch(url, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(opt.timeout || 45000),
      });
      this.keep(res);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).href;
        method = "GET";
        body = undefined;
        continue;
      }
      if (asBuffer) {
        return {
          status: res.status,
          url,
          buffer: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get("content-type") || "",
        };
      }
      return { status: res.status, url, html: await res.text() };
    }
    throw new Error("Bahut zyada redirect (login ya session ki dikkat)");
  }
  request(path, opt = {}) {
    return this.send(path, opt, false);
  }
  requestBuffer(path, opt = {}) {
    return this.send(path, { timeout: 60000, ...opt }, true);
  }
}

// form ke saare fields (hidden samet) object me
function formFields($, form) {
  const data = {};
  form.find("input, select, textarea").each((i, el) => {
    const n = $(el).attr("name");
    if (!n) return;
    const tag = el.tagName.toLowerCase();
    const t = ($(el).attr("type") || "text").toLowerCase();
    if (
      tag === "input" &&
      ["submit", "button", "image", "file", "reset"].includes(t)
    )
      return;
    if (
      tag === "input" &&
      ["checkbox", "radio"].includes(t) &&
      !$(el).is(":checked")
    )
      return;
    data[n] = $(el).val() ?? "";
  });
  return data;
}

// page ke baare me chhoti jaankari (error message ke liye)
function pageNote($, url) {
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const msgs = $(
    ".field-validation-error, .validation-summary-errors, .alert, .error, .text-danger, .text-error, .help-inline, #divJsonError",
  )
    .map((i, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .slice(0, 3);
  return (
    `page: ${url} | title: "${title}"` +
    (msgs.length ? ` | message: ${msgs.join(" / ")}` : "")
  );
}

// ---------- login ----------
async function login(say = () => {}) {
  hwBroken = false;
  hwOkAny = false;

  if (!configured())
    throw new Error(
      "PAYTV_USERNAME / PAYTV_PASSWORD server ke environment me set nahi hain",
    );

  const now = Date.now();

  // 1. CACHE CHECK: Agar pichla login 25 minute ke andar hua tha, toh seedha session wapas bhej do
  if (cachedSession && now - lastLoginTime < SESSION_TIMEOUT) {
    say("⚡ Purana session active hai (Bina naya login kiye Fast Sync)");
    return cachedSession;
  }

  say("🔑 Naya session bana rahe hain...");

  const s = new Session();
  const page = await s.request(process.env.PAYTV_LOGIN_PATH || "/UserLogin");
  const $ = cheerio.load(page.html);
  const form = $("form")
    .filter((i, el) => $(el).find("input[type=password]").length > 0)
    .first();
  if (!form.length)
    throw new Error("Login form nahi mila. " + pageNote($, page.url));

  const data = formFields($, form);

  const pwd =
    process.env.PAYTV_PASS_FIELD ||
    form.find("input[type=password]").first().attr("name");
  const textBoxes = form
    .find("input")
    .filter((i, el) => {
      const t = ($(el).attr("type") || "text").toLowerCase();
      return $(el).attr("name") && (t === "text" || t === "email");
    })
    .map((i, el) => $(el).attr("name"))
    .get();
  const usr = process.env.PAYTV_USER_FIELD || textBoxes[0];
  if (!pwd || !usr)
    throw new Error("Login form me username/password ke field nahi mile");

  const action = new URL(form.attr("action") || page.url, page.url).href;

  data[usr] = USER();
  data[pwd] = PASS();
  const sub = form.find("[type=submit][name]").first();
  if (sub.length) data[sub.attr("name")] = sub.attr("value") || "";

  const r = await s.request(action, {
    method: "POST",
    form: data,
    referer: page.url,
  });

  const $r = cheerio.load(r.html);
  const stillLogin = $r("input[type=password]").length > 0;
  const path = new URL(r.url).pathname;
  const looksLoggedIn =
    /UserLogout|MyDashboard|MultiFranchise|SelectLoginFranchise/i.test(
      r.html,
    ) || /MultiFranchise|MyDashboard|SelectLoginFranchise/i.test(path);

  if (stillLogin || !looksLoggedIn)
    throw new Error("PayTV login nahi hua. " + pageNote($r, r.url));

  say(`✔ PayTV login ho gaya (${path})`);

  // 2. CACHE SAVE: Jab login successful ho jaye, toh use cache me save kar lo
  cachedSession = s;
  lastLoginTime = Date.now();

  return s;
}

// ---------- franchisee badalna (/MultiFranchise) ----------
async function switchTo(s, f) {
  const page = await s.request("/MultiFranchise");
  const $ = cheerio.load(page.html);
  const key = f.encodedId;
  const keyEnc = encodeURIComponent(key).toLowerCase();

  let href = "";
  $("a[href]").each((i, el) => {
    const v = $(el).attr("href") || "";
    if (!href && (v.includes(key) || v.toLowerCase().includes(keyEnc)))
      href = v;
  });
  if (href)
    return s.request(new URL(href, page.url).href, { referer: page.url });

  let hit = null;
  $("form").each((i, fm) => {
    if (hit) return;
    const el = $(fm)
      .find("[value]")
      .filter((j, x) => $(x).attr("value") === key)
      .first();
    if (el.length) hit = { form: $(fm), el };
  });
  if (hit) {
    const data = formFields($, hit.form);
    const tag = hit.el.get(0).tagName.toLowerCase();
    const name =
      tag === "option"
        ? hit.el.closest("select").attr("name")
        : hit.el.attr("name");
    if (name) data[name] = key;
    const action = new URL(hit.form.attr("action") || page.url, page.url).href;
    return s.request(action, {
      method: "POST",
      form: data,
      referer: page.url,
    });
  }
  throw new Error(
    "MultiFranchise page par is franchisee ka link/option nahi mila",
  );
}

// =====================================================
// BILLS
// =====================================================
function parseBills($) {
  const out = [];
  $("#tbl tbody tr").each((i, tr) => {
    const td = $(tr).find("td");
    if (td.length < 11) return;
    const t = (k) => $(td[k]).text().replace(/\s+/g, " ").trim();
    const num = (k) => Number(t(k).replace(/,/g, "")) || 0;
    const date = toIso(t(2));
    if (!date) return;
    const name = t(4);
    const m = /^(.*?)\s*\(\s*([^()]*?)\s*\)\s*$/.exec(name);
    out.push({
      internalId: $(td[0]).find("input").attr("value") || "",
      billNo: t(1),
      date,
      subscriber: m ? m[1] : name,
      subNo: m ? m[2] : "",
      type: t(5),
      prodAmt: num(6),
      tax: num(9),
      amount: num(10),
    });
  });
  return out;
}

async function fetchBills(s, f, from, to) {
  const page = await s.request("/Bills");
  let $ = cheerio.load(page.html);
  const active = String($("#FranchiseeID").val() || "").trim();
  const targetId = String(f.franchiseId).trim();

  if (active && active !== targetId) {
    throw new Error(
      `Franchisee switch nahi hua (page par "${active || "khali"}" hai, chahiye ${targetId})`,
    );
  }

  const form = $("form")
    .filter((i, el) => $(el).find("#FromBillDate").length > 0)
    .first();
  const action = new URL(form.attr("action") || "/Bills", page.url).href;
  const base = formFields($, form);
  Object.assign(base, {
    FromBillNo: "",
    ToBillNo: "",
    TypeID: "-1",
    FromBillDate: toDmy(from),
    ToBillDate: toDmy(to),
    CustomerName: "",
    CustomerID: "",
    action: "Index",
  });

  const rows = [];
  const seen = new Set();
  for (let p = 1; p <= 30; p++) {
    const url = p === 1 ? action : `${action}?page=${p}`;
    const r = await s.request(url, {
      method: "POST",
      form: base,
      referer: page.url,
    });
    $ = cheerio.load(r.html);
    const fresh = parseBills($).filter((x) => !seen.has(x.billNo));
    fresh.forEach((x) => {
      seen.add(x.billNo);
      rows.push(x);
    });
    if (!fresh.length) break;
    const m = /Showing\s+(\d+)\s+of\s+(\d+)\s+from/i.exec($(".clear").text());
    if (!m || Number(m[1]) >= Number(m[2])) break;
  }
  return rows;
}

// =====================================================
// RECHARGE LEDGER (wallet se jo deduct hua / wapas mila)
// =====================================================
function parseTranTime(v) {
  const none = { iso: "", date: null };
  if (v === null || v === undefined || v === "") return none;

  const p2 = (n) => String(n).padStart(2, "0");
  const build = (y, mo, d, H = 0, M = 0, S = 0) => ({
    iso: `${y}-${p2(mo)}-${p2(d)}`,
    date: new Date(Date.UTC(y, mo - 1, d, H, M, S) - 19800000), // PayTV ka time IST hai
  });

  if (v instanceof Date && !isNaN(v)) {
    return { iso: v.toISOString().slice(0, 10), date: v };
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d && d.y ? build(d.y, d.m, d.d, d.H, d.M, d.S) : none;
  }

  const t = String(v).trim();
  const clock = (h, mi, se, ap) => {
    let H = Number(h || 0);
    if (ap && /pm/i.test(ap) && H < 12) H += 12;
    if (ap && /am/i.test(ap) && H === 12) H = 0;
    return [H, Number(mi || 0), Number(se || 0)];
  };
  const tail = "(?:[ T]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(AM|PM)?)?";

  let m = new RegExp(
    `^(\\d{1,2})[\\/\\-.](\\d{1,2})[\\/\\-.](\\d{4})${tail}`,
    "i",
  ).exec(t);
  if (m) return build(+m[3], +m[2], +m[1], ...clock(m[4], m[5], m[6], m[7]));

  m = new RegExp(
    `^(\\d{1,2})[\\/\\- ]([A-Za-z]{3})[A-Za-z]*[\\/\\- ](\\d{4})${tail}`,
    "i",
  ).exec(t);
  if (m) {
    const mon = m[2].charAt(0).toUpperCase() + m[2].slice(1, 3).toLowerCase();
    if (MONTHS[mon])
      return build(
        +m[3],
        +MONTHS[mon],
        +m[1],
        ...clock(m[4], m[5], m[6], m[7]),
      );
  }
  return none;
}

async function openLedgerForm(s, f) {
  const page = await s.request("/FReports/RechargeLedger");
  const $ = cheerio.load(page.html);
  const active = String($("#FranchiseID").val() || "").trim();
  if (active !== String(f.franchiseId))
    throw new Error(
      `Recharge ledger par franchisee galat hai (page par "${active || "khali"}", chahiye ${f.franchiseId})`,
    );
  const form = $("#frmreport");
  if (!form.length) throw new Error("Recharge ledger ka form nahi mila");
  return { page, data: formFields($, form) };
}

async function fetchRechargeLedger(s, f, from, to, say = () => {}) {
  const { page, data } = await openLedgerForm(s, f);

  Object.assign(data, {
    rptType: "ExcelNoFormate",
    txtfdate: toDmy(from),
    txttdate: toDmy(to),
  });

  const result = await s.request("/FReports/RechargeLedger", {
    method: "POST",
    form: data,
    referer: page.url,
  });

  const text = String(result.html || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!/^Suc{1,2}ess$/i.test(text))
    throw new Error(`report nahi bani: ${text.slice(0, 200)}`);

  let file = null;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await s.requestBuffer("/SendReportFiles/Showrpt/", {
        referer: page.url,
      });
      if (r.buffer && r.buffer.length > 100) {
        file = r.buffer;
        break;
      }
    } catch {
      // agli koshish
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  if (!file) throw new Error("report ki Excel file nahi mili");

  const wb = XLSX.read(file, { type: "buffer" });
  const sheet = wb.SheetNames[0];
  if (!sheet) throw new Error("Excel me koi sheet nahi mili");
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
    header: 1,
    defval: "",
  });

  let hIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const line = grid[i].map((x) => String(x).trim().toLowerCase());
    if (
      line.some((x) => x.includes("narration")) &&
      line.some((x) => x.includes("out"))
    ) {
      hIdx = i;
      break;
    }
  }
  if (hIdx < 0) {
    const blank = grid.every((row) => row.every((c) => c === ""));
    if (blank) return [];
    throw new Error(
      "header row nahi mili. Pehli rows: " +
        JSON.stringify(grid.slice(0, 3)).slice(0, 300),
    );
  }

  const header = grid[hIdx].map((x) => String(x).trim().toLowerCase());
  const col = (...names) => {
    for (const n of names) {
      const i = header.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const tranCol = col("tran. time", "tran time", "date");
  const typeCol = col("transaction type");
  const narrCol = col("narration");
  const remCol = col("remarks");
  const inCol = col("in amount", "in amt", "credit");
  const outCol = col("out amount", "out amt", "debit");
  const balCol = col("balance");
  if (narrCol < 0 || outCol < 0)
    throw new Error(`columns nahi mile: ${header.join(" | ")}`);

  const num = (v) => {
    const n = Number(
      String(v ?? "")
        .replace(/,/g, "")
        .trim(),
    );
    return Number.isFinite(n) ? n : 0;
  };

  const out = [];
  let dataRows = 0;
  let badDates = 0;

  for (const row of grid.slice(hIdx + 1)) {
    const narration = String(row[narrCol] || "").trim();
    if (!narration) continue;
    dataRows++;

    const m = /Sub\.?\s*No\.?\s*[:\-]?\s*([A-Za-z0-9]+)/i.exec(narration);
    if (!m) continue; // wallet top-up jaisi entries, jinme Sub.No nahi hota

    const rawTime = tranCol >= 0 ? row[tranCol] : "";
    const tt = parseTranTime(rawTime);
    if (!tt.iso) badDates++;

    const transactionType =
      typeCol >= 0 ? String(row[typeCol] || "").trim() : "";
    const remarks = remCol >= 0 ? String(row[remCol] || "").trim() : "";
    const inAmount = inCol >= 0 ? num(row[inCol]) : 0;
    const outAmount = num(row[outCol]);
    const balance = balCol >= 0 ? num(row[balCol]) : 0;

    const key = crypto
      .createHash("sha1")
      .update(
        [
          f.franchiseId,
          String(rawTime),
          transactionType,
          narration,
          inAmount,
          outAmount,
          balance,
        ].join("|"),
      )
      .digest("hex");

    out.push({
      franchiseId: String(f.franchiseId),
      tranTime: tt.date,
      transactionType,
      narration,
      remarks,
      subNo: m[1].trim().toUpperCase(),
      inAmount,
      outAmount,
      balance,
      date: tt.iso || from,
      key,
    });
  }

  say(
    `   ledger: ${dataRows} rows, Sub.No wali ${out.length}` +
      (badDates ? `, ${badDates} rows ki date samajh nahi aayi` : ""),
  );
  return out;
}

// =====================================================
// SUBSCRIBER KE PACKAGE / ADDON / CHANNEL
// =====================================================
const clean = (v) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();

// PayTV ka PackType text jaisa hai waisa hi rakho (type ka naam collection.js tay karta hai)
const packageType = (v) => clean(v);

const encodePaytvId = (id) => Buffer.from(String(id)).toString("base64");

async function findSubscriberBySubNo(s, franchisee, subNo) {
  const consumerId = clean(subNo).toUpperCase();
  if (!consumerId) return null;

  const r = await s.request(
    `${BASE}/Json/GetSubscriberList/` +
      `?clientName=${encodeURIComponent(consumerId)}` +
      `&companyid=1` +
      `&franchiseid=${encodeURIComponent(String(franchisee.franchiseId))}`,
  );
  if (r.status < 200 || r.status >= 300)
    throw new Error(`Subscriber lookup fail ${consumerId}: HTTP ${r.status}`);

  let data;
  try {
    data = JSON.parse(r.html);
  } catch {
    throw new Error(`Subscriber lookup JSON nahi mila: ${consumerId}`);
  }
  if (!Array.isArray(data) || !data.length) return null;

  const exact = data.find((item) =>
    clean(item && item.Text)
      .toUpperCase()
      .includes(consumerId),
  );
  const item = exact || data[0];
  const customerId = Number(item && item.Value);
  if (!Number.isFinite(customerId) || customerId <= 0) return null;

  return {
    customerId,
    encodedId: encodePaytvId(customerId),
    displayText: clean(item.Text),
  };
}

const HW_URL_RE =
  /(?:ManageSubscriber\/ManageHadware|ManageSubscriber\/ManageHardware|HardwareService\/Active)\/[A-Za-z0-9=%+._-]+/gi;

async function getManageHardwarePage(s, customer) {
  const encodedId = customer.encodedId;
  const listPagePath = `/ManageSubscriber/ManageHadware/${encodedId}`;

  let listPage;
  try {
    listPage = (await listPagePath)
      ? await s.request(listPagePath, { referer: `${BASE}/ManageSubscriber` })
      : null;
  } catch (e) {
    throw new Error(`HWPAGE: Hardware list fail: ${e.message}`);
  }

  const $list = cheerio.load(listPage.html || "");
  const popupUrls = [];

  // Purple button dhoondho
  $list("a").each((i, el) => {
    const onclick = ($list(el).attr("onclick") || "").trim();
    const m = /OpenPackageModel\(['"]([^'"]+)['"]\)/i.exec(onclick);
    if (m && m[1]) {
      const path = m[1];
      if (!popupUrls.includes(path)) popupUrls.push(path);
    }
  });

  // Agar button nahi hai toh 0 package
  if (popupUrls.length === 0) {
    return { html: "", status: 200, url: listPage.url };
  }

  let combinedHtml = "";
  const tried = [];

  for (const path of popupUrls) {
    try {
      // 🔥 AJAX header bhej rahe hain taaki HTTP 500 error na aaye
      const page = await s.request(path, {
        referer: listPage.url,
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (page.status >= 200 && page.status < 300) {
        combinedHtml += `\n<!-- POPUP PAGE: ${path} -->\n` + (page.html || "");
      } else {
        tried.push(`HTTP ${page.status}`);
      }
    } catch (e) {
      tried.push(`Err: ${e.message}`);
    }
  }

  if (!combinedHtml.trim()) {
    // undefined fix kar diya hai (Ab customer ka naam print hoga)
    console.log(
      `[DEBUG] ⚠️ ${customer.displayText || encodedId} ka popup fail hua (${tried.join(", ")}). Ise 0 packages maan rahe hain.`,
    );
    return { html: "", status: 200, url: listPage.url };
  }

  return { html: combinedHtml, status: 200, url: popupUrls[0] };
}

// Clean Popup Table Se Seedha Data Uthayenge
// Clean Popup Table Se Seedha Data Uthayenge
function parseActivePackages($, fallbackSubscriber = "") {
  const unique = new Map();

  $("tr").each((_, tr) => {
    const tds = $(tr).find("td");

    // Asli package table me 5 columns (Name, Type, Amount, Start, End) hote hain
    if (tds.length >= 5) {
      const name = clean($(tds[0]).text());

      // "Total" wali aakhiri row aur khali rows ko ignore karo
      if (!name || name.toLowerCase().includes("total")) return;

      const rawType = clean($(tds[1]).text()).toLowerCase();
      let type = "Addon"; // Default fallback

      // Sahi category set karne ka naya aur bulletproof logic:
      // Agar naam me BOUQUET ya ADDON likha hai, toh 100% Addon hai
      const upperName = name.toUpperCase();
      if (upperName.includes("BOUQUET") || upperName.includes("ADDON")) {
        type = "Addon";
      }
      // Agar channel/alacarte hai, toh Channel hai
      else if (
        rawType.includes("a-la carte") ||
        rawType.includes("channel") ||
        rawType.includes("alacarte")
      ) {
        type = "Channel";
      }
      // Agar basic ya package hai (aur bouquet nahi hai), toh Basic hai
      else if (rawType.includes("basic") || rawType.includes("package")) {
        type = "Basic";
      }

      const priceText = clean($(tds[2]).text());
      const price = Number(priceText.replace(/,/g, "").trim());

      const startDate = clean($(tds[3]).text());

      unique.set(`${upperName}|${type.toUpperCase()}|${startDate}`, {
        name,
        type,
        paytvPrice: Number.isFinite(price) ? price : 0,
        paytvPackageId: "",
        startDate,
        startDateAlt: startDate,
        subscriber: fallbackSubscriber,
        active: true,
      });
    }
  });

  const final = [...unique.values()];

  // Terminal output
  if (final.length > 0) {
    console.log(
      `[DEBUG] ${fallbackSubscriber} -> ${final.length} packs:`,
      final.map((p) => `${p.name} (${p.type})`).join(" | "),
    );
  }

  return final;
}

// return: { rows, okSubs }  (okSubs = jin subscribers ka page sahi padha gaya)
async function fetchSubscriberPackages(
  s,
  franchisee,
  billRows = [],
  from,
  to,
  say = () => {},
) {
  if (hwBroken) {
    say(`⚠ ${franchisee.name}: package page ka rasta pehle hi fail hua, skip`);
    return { rows: [], okSubs: [] };
  }

  const subscribers = new Map();
  for (const row of billRows) {
    const subNo = clean(row.subNo).toUpperCase();
    if (!subNo) continue;
    subscribers.set(subNo, { subNo, subscriber: clean(row.subscriber) });
  }
  if (!subscribers.size) return { rows: [], okSubs: [] };

  const rows = [];
  const okSubs = [];
  let hardFails = 0;

  for (const customer of subscribers.values()) {
    if (hardFails >= 2 && okSubs.length === 0) {
      if (!hwOkAny) hwBroken = true;
      say(
        `⚠ ${franchisee.name}: package page ka rasta nahi mila, baaki subscribers skip`,
      );
      break;
    }

    try {
      const found = await findSubscriberBySubNo(s, franchisee, customer.subNo);
      if (!found) {
        say(`⚠ ${franchisee.name}: ${customer.subNo} PayTV par nahi mila`);
        continue;
      }

      const page = await getManageHardwarePage(s, found);
      const $ = cheerio.load(page.html || "");

      // ❌ Yahan se strict error checking wali condition (fields nahi mile) hata di gayi hai ❌
      // Ab agar customer ke paas 0 packages hain, toh wo normally skip hone ke bajaye
      // database me '0 packages' ki tarah properly sync hoga.

      const pageRows = parseActivePackages(
        $,
        customer.subscriber || clean(found.displayText),
      );

      for (const row of pageRows) {
        rows.push({
          franchiseId: String(franchisee.franchiseId),
          subNo: customer.subNo,
          ...row,
          subscriber: row.subscriber || customer.subscriber,
        });
      }

      // Customer success list me daal do (bhale hi package 0 kyun na hon)
      okSubs.push(customer.subNo);
      hwOkAny = true;
    } catch (e) {
      if (String(e.message).startsWith("HWPAGE:")) hardFails++;
      say(
        `⚠ ${franchisee.name}: ${customer.subNo} package sync fail - ${e.message}`,
      );
    }
  }

  return { rows, okSubs };
}

module.exports = {
  BASE,
  configured,
  login,
  switchTo,
  fetchBills,
  fetchRechargeLedger,
  fetchSubscriberPackages,
};
