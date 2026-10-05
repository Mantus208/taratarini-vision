const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, PERMS, logActivity } = require("../models");
const { fail, h, auth, pub, notify, usersWith } = require("../middleware");

const sign = (u) =>
  jwt.sign({ u: u.username }, process.env.JWT_SECRET, { expiresIn: "12h" });
const clean = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

router.post(
  "/signup",
  h(async (req, res) => {
    const { name, password, answer } = req.body;
    const un = clean(req.body.username);
    if (!/^[a-z0-9_.]{3,20}$/.test(un))
      throw fail("Username 3-20 character ka ho (a-z, 0-9, _ .)");
    if (String(password || "").length < 6)
      throw fail("Password kam se kam 6 character ka ho");
    if (!String(name || "").trim() || !String(answer || "").trim())
      throw fail("Naam aur secret answer zaroori hai");
    if (await User.exists({ username: un }))
      throw fail("Ye username pehle se hai");

    const first = (await User.countDocuments()) === 0;
    const doc = {
      username: un,
      name: String(name).trim(),
      passHash: await bcrypt.hash(String(password), 10),
      secHash: await bcrypt.hash(clean(answer), 10),
      status: first ? "Active" : "Pending",
    };
    PERMS.forEach((k) => (doc[k] = first));
    if (!first)
      ["canRequest", "canRaiseComplaint", "canViewComplaints"].forEach(
        (k) => (doc[k] = true),
      );
    await User.create(doc);
    logActivity(
      "user",
      un,
      "Naya signup: " +
        doc.name +
        (first ? " (pehla user, Admin bana)" : " (Admin approval baaki)"),
    );

    if (!first)
      notify(await usersWith("isAdmin"), {
        title: "👤 Naya user signup",
        body: doc.name + " ko activate karna hai",
        url: "/#users",
      });
    res.json({
      message: first
        ? "Aap pehle user ho, Admin ban gaye. Ab login karein."
        : "Signup ho gaya. Admin activate karega tab login kar paoge.",
    });
  }),
);

router.post(
  "/login",
  h(async (req, res) => {
    const u = await User.findOne({ username: clean(req.body.username) });
    const ok =
      u && (await bcrypt.compare(String(req.body.password || ""), u.passHash));
    if (!ok) throw fail("Invalid username or password");
    if (u.status === "Pending")
      throw fail("Admin ne abhi aapko activate nahi kiya");
    if (u.status !== "Active") throw fail("Aapka account band hai");
    logActivity("auth", u.username, "Login kiya");
    res.json({ token: sign(u), user: pub(u) });
  }),
);

router.post(
  "/forgot",
  h(async (req, res) => {
    const u = await User.findOne({ username: clean(req.body.username) });
    const ok = u && (await bcrypt.compare(clean(req.body.answer), u.secHash));
    if (!ok) throw fail("Username ya secret answer galat hai");
    if (String(req.body.newPass || "").length < 6)
      throw fail("Naya password kam se kam 6 character ka ho");
    u.passHash = await bcrypt.hash(String(req.body.newPass), 10);
    await u.save();
    logActivity("auth", u.username, "Secret answer se password badla");
    res.json({ message: "Password badal gaya. Ab login karein." });
  }),
);

router.get("/me", auth, (req, res) => res.json({ user: pub(req.user) }));

router.post(
  "/change-password",
  auth,
  h(async (req, res) => {
    const { oldPass, newPass } = req.body;
    if (!(await bcrypt.compare(String(oldPass || ""), req.user.passHash)))
      throw fail("Purana password galat hai");
    if (String(newPass || "").length < 6)
      throw fail("Naya password kam se kam 6 character ka ho");
    req.user.passHash = await bcrypt.hash(String(newPass), 10);
    await req.user.save();
    logActivity("auth", req.user.username, "Apna password badla");
    res.json({ message: "Password badal gaya" });
  }),
);

module.exports = router;
