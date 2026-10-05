const mongoose = require("mongoose");

const { Schema } = mongoose;

// =====================================================
// PayTV ke franchisee aur unka working staff
// =====================================================
const Franchisee = mongoose.model(
  "Franchisee",
  new Schema(
    {
      franchiseId: { type: String, unique: true },
      name: String,
      encodedId: String,
      staff: { type: String, default: "" },
      hiddenFrom: { type: String, default: "" },
    },
    { timestamps: true },
  ),
);

// =====================================================
// Staff commission - per customer (sirf Basic wale customer par)
// =====================================================
const StaffRate = mongoose.model(
  "StaffRate",
  new Schema({
    staff: { type: String, unique: true },
    commission: { type: Number, default: 0 },
  }),
);

// =====================================================
// PACKAGE / ADDON / CHANNEL ka customer price
// priceSet = true tabhi jab admin ne price khud set kiya ho (0 bhi price hai: free)
// =====================================================
const packagePriceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    customerPrice: { type: Number, default: 0, min: 0 },
    priceSet: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
packagePriceSchema.index({ name: 1, type: 1 }, { unique: true });
const PackagePrice = mongoose.model("PackagePrice", packagePriceSchema);

// =====================================================
// SUBSCRIBER KE PACKAGE (PayTV hardware page se)
// Har activation alag record (startIso ke saath), taaki purane mahine ka hisaab bana rahe
// =====================================================
const subscriberPackageSchema = new Schema(
  {
    franchiseId: { type: String, required: true, index: true },
    subNo: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    subscriber: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    paytvPrice: { type: Number, default: 0 },
    paytvPackageId: { type: String, default: "" },
    startDate: { type: String, default: "" }, // PayTV ka original text
    startIso: { type: String, default: "" }, // yyyy-mm-dd
    active: { type: Boolean, default: true },
    lastSyncAt: { type: Date, default: null },
  },
  { timestamps: true },
);
subscriberPackageSchema.index(
  { franchiseId: 1, subNo: 1, name: 1, type: 1, startIso: 1 },
  { unique: true },
);
const SubscriberPackage = mongoose.model(
  "SubscriberPackage",
  subscriberPackageSchema,
);

// =====================================================
// PayTV bills
// =====================================================
const billSchema = new Schema({
  franchiseId: String,
  billNo: String,
  internalId: String,
  subNo: String,
  subscriber: String,
  date: String, // yyyy-mm-dd
  type: String,
  prodAmt: Number,
  tax: Number,
  amount: Number,
});
billSchema.index({ franchiseId: 1, billNo: 1 }, { unique: true });
billSchema.index({ date: 1 });
const PaytvBill = mongoose.model("PaytvBill", billSchema);

// =====================================================
// PayTV Recharge Ledger
// Actual recharge = SUM(outAmount) - SUM(inAmount)
// =====================================================
const PaytvRecharge = mongoose.model(
  "PaytvRecharge",
  new Schema(
    {
      franchiseId: String,
      tranTime: Date,
      transactionType: String,
      narration: String,
      remarks: String,
      subNo: String,
      inAmount: Number,
      outAmount: Number,
      balance: Number,
      date: String,
      key: { type: String, unique: true },
    },
    { timestamps: true },
  ),
);

// =====================================================
// Sync metadata
// =====================================================
const SyncMeta = mongoose.model(
  "SyncMeta",
  new Schema({
    _id: String,
    value: Schema.Types.Mixed,
  }),
);

module.exports = {
  Franchisee,
  StaffRate,
  PackagePrice,
  SubscriberPackage,
  PaytvBill,
  PaytvRecharge,
  SyncMeta,
};
