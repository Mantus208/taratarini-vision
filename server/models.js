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
  "canViewActivity",
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
      code: {
        type: String,
        unique: true,
      },

      category: {
        type: String,
        default: "Other",
      },

      scope: {
        type: String,
        enum: ["Single", "Area", "Village", "Main"],
        default: "Single",
      },

      location: {
        type: String,
        default: "",
      },

      description: {
        type: String,
        default: "",
      },

      raisedBy: {
        type: String,
        default: "",
      },

      /*
       * Optional known site location.
       *
       * Customer does NOT submit this.
       * Later this can come from customer/transmitter
       * master data if available.
       */
      siteLocation: {
        lat: {
          type: Number,
          default: null,
        },
        lng: {
          type: Number,
          default: null,
        },
      },

      status: {
        type: String,
        enum: ["Open", "Resolved"],
        default: "Open",
      },

      /*
       * Field verification
       */
      fieldVisit: {
        status: {
          type: String,
          enum: ["NotStarted", "Active", "Completed"],
          default: "NotStarted",
        },

        startedBy: {
          type: String,
          default: "",
        },

        startedAt: {
          type: Date,
          default: null,
        },

        startLocation: {
          lat: {
            type: Number,
            default: null,
          },
          lng: {
            type: Number,
            default: null,
          },
          accuracy: {
            type: Number,
            default: null,
          },
        },

        completedBy: {
          type: String,
          default: "",
        },

        completedAt: {
          type: Date,
          default: null,
        },

        completeLocation: {
          lat: {
            type: Number,
            default: null,
          },
          lng: {
            type: Number,
            default: null,
          },
          accuracy: {
            type: Number,
            default: null,
          },
        },

        /*
         * One compressed image as data URL.
         * Frontend will resize/compress before sending.
         */
        photoData: {
          type: String,
          default: "",
        },
      },

      resolvedBy: {
        type: String,
        default: "",
      },

      resolvedAt: {
        type: Date,
        default: null,
      },

      note: {
        type: String,
        default: "",
      },
    },

    {
      timestamps: true,
    },
  ),
);

// ---------- activity log ----------
const activitySchema = new Schema(
  {
    type: String, // income, request, vote, purchase, complaint, resolve, user, auth
    by: String, // username
    text: String,
  },
  { timestamps: true },
);
activitySchema.index({ createdAt: -1 });
const Activity = mongoose.model("Activity", activitySchema);

// log likhte waqt koi galti ho to app na ruke
async function logActivity(type, by, text) {
  try {
    await Activity.create({ type, by, text });
  } catch (e) {
    console.error("activity log error:", e.message);
  }
}

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
    { returnDocument: "after", upsert: true },
  );
  return prefix + String(c.seq).padStart(4, "0");
}

module.exports = {
  PERMS,
  User,
  Income,
  Source,
  Request,
  Complaint,
  Activity,
  nextCode,
  logActivity,
};
