const mongoose = require("mongoose");
const { Schema } = mongoose;

const PERMS = [
  "isAdmin",
  "canApprove",
  "canViewLedger",
  "canAddIncome",
  "canRequest",
  "canPurchase",
  "canViewComplaints",
  "canRaiseComplaint",
  "canResolve",
];
const permFields = {};
PERMS.forEach((k) => (permFields[k] = { type: Boolean, default: false }));

const subSchema = new Schema(
  {
    endpoint: String,
    keys: { p256dh: String, auth: String },
  },
  { _id: false },
);

const User = mongoose.model(
  "User",
  new Schema(
    {
      username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      name: String,
      passHash: String,
      secHash: String,
      status: {
        type: String,
        enum: ["Active", "Pending", "Disabled"],
        default: "Pending",
      },
      ...permFields,
      pushSubs: [subSchema],
    },
    { timestamps: true },
  ),
);

const Income = mongoose.model(
  "Income",
  new Schema(
    {
      date: { type: String, required: true }, // yyyy-mm-dd
      source: { type: String, required: true },
      amount: { type: Number, required: true },
      remark: { type: String, default: "" },
      addedBy: String,
    },
    { timestamps: true },
  ),
);

const Source = mongoose.model(
  "Source",
  new Schema({
    name: String,
    key: { type: String, unique: true },
  }),
);

const voteSchema = new Schema(
  {
    user: String,
    vote: String, // 'Y' ya 'N'
    date: { type: Date, default: Date.now },
  },
  { _id: false },
);

const Request = mongoose.model(
  "Request",
  new Schema(
    {
      code: { type: String, unique: true }, // R-0001
      type: { type: String, enum: ["Expense", "Item"], default: "Expense" },
      title: String,
      amount: Number,
      remark: { type: String, default: "" },
      requestedBy: String,
      date: String,
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "Purchased"],
        default: "Pending",
      },
      votes: [voteSchema],
      purchasedBy: String,
      purchaseDate: String,
      actualAmount: { type: Number, default: 0 },
      purchaseNote: { type: String, default: "" },
    },
    { timestamps: true },
  ),
);

const Complaint = mongoose.model(
  "Complaint",
  new Schema(
    {
      code: { type: String, unique: true }, // T-0001
      category: String,
      scope: {
        type: String,
        enum: ["Single", "Area", "Village", "Main"],
        default: "Single",
      },
      location: String,
      description: String,
      raisedBy: String,
      status: { type: String, enum: ["Open", "Resolved"], default: "Open" },
      resolvedBy: String,
      resolvedAt: Date,
      note: { type: String, default: "" },
    },
    { timestamps: true },
  ),
);

const Counter = mongoose.model(
  "Counter",
  new Schema({
    _id: String,
    seq: { type: Number, default: 0 },
  }),
);
async function nextCode(prefix) {
  const c = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return prefix + String(c.seq).padStart(4, "0");
}

module.exports = { PERMS, User, Income, Source, Request, Complaint, nextCode };
