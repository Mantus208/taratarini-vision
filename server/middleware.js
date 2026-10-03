const jwt = require("jsonwebtoken");
const webpush = require("web-push");
const { User, PERMS } = require("./models");

const fail = (msg, code = 400) => {
  const e = new Error(msg);
  e.status = code;
  return e;
};
const h = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const has = (u, k) => !!(u.isAdmin || u[k]);
const perms = (u) => Object.fromEntries(PERMS.map((k) => [k, has(u, k)]));
const pub = (u) => ({ username: u.username, name: u.name, perms: perms(u) });

const need = (k, msg) => (req, res, next) =>
  has(req.user, k)
    ? next()
    : next(
        fail(msg || "You do not have permission to perform this action.", 403),
      );

const auth = h(async (req, res, next) => {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  let p;
  try {
    p = jwt.verify(t, process.env.JWT_SECRET);
  } catch {
    throw fail("SESSION_EXPIRED", 401);
  }
  const u = await User.findOne({ username: p.u });
  if (!u || u.status !== "Active") throw fail("SESSION_EXPIRED", 401);
  req.user = u;
  next();
});

// ---------- push notification ----------
const pushOn = !!(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE);
if (pushOn) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE,
  );
}

async function notify(usernames, payload) {
  try {
    if (!pushOn || !usernames.length) return;
    const users = await User.find({
      username: { $in: usernames },
      status: "Active",
    });
    for (const u of users) {
      const dead = [];
      await Promise.all(
        u.pushSubs.map((s) =>
          webpush
            .sendNotification(s.toObject(), JSON.stringify(payload))
            .catch((e) => {
              if (e.statusCode === 404 || e.statusCode === 410)
                dead.push(s.endpoint);
            }),
        ),
      );
      if (dead.length)
        await User.updateOne(
          { _id: u._id },
          { $pull: { pushSubs: { endpoint: { $in: dead } } } },
        );
    }
  } catch (e) {
    console.error("push error:", e.message);
  }
}

// jinke paas ye permission hai (Admin hamesha shamil)
async function usersWith(key, exclude = []) {
  const us = await User.find({
    status: "Active",
    $or: [{ isAdmin: true }, { [key]: true }],
  });
  return us.map((u) => u.username).filter((x) => !exclude.includes(x));
}

module.exports = { fail, h, has, perms, pub, need, auth, notify, usersWith };
