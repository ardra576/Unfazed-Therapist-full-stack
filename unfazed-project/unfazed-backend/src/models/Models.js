import mongoose from "mongoose";

const therapistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  bio: { type: String, default: "" },
  specializations: [{ type: String }],
  languages: [{ type: String }],
  tier: { type: String, enum: ["free", "pro", "premium"], default: "free" }
}, { timestamps: true });

const clientSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
  name: { type: String, required: true },
  email: String,
  phone: String,
  status: { type: String, default: "active" },
  tags: [String],
  consentAt: Date
}, { timestamps: true });

const slotSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  isBooked: { type: Boolean, default: false }
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, ref: "Slot", required: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  status: { type: String, default: "confirmed" }
}, { timestamps: true });

const noteSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  content: { type: String, required: true },
  visibility: { type: String, enum: ["private", "shared"], default: "private" }
}, { timestamps: true });

const paymentSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
  amount: { type: Number, required: true, min: 0 },
  description: String,
  status: { type: String, enum: ["created", "paid", "failed"], default: "paid" },
  gateway: { type: String, default: "demo" },
  transactionId: String
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: "Therapist", required: true },
  clientName: String,
  sender: String,
  message: String
}, { timestamps: true });

const tierSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  caps: { activeClients: Number },
  features: [String]
});

export const Therapist = mongoose.model("Therapist", therapistSchema);
export const Client = mongoose.model("Client", clientSchema);
export const Slot = mongoose.model("Slot", slotSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
export const SessionNote = mongoose.model("SessionNote", noteSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
export const Message = mongoose.model("Message", messageSchema);
export const SubscriptionTierConfig = mongoose.model("SubscriptionTierConfig", tierSchema);
