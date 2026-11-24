import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { auth } from "./middleware/auth.js";
import { requireFeature, clientLimitReached } from "./middleware/entitlement.js";
import { Therapist, Client, Slot, Booking, SessionNote, Payment, Message } from "./models/Models.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
const router = express.Router();
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const tokenFor = user => jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "development_secret", { expiresIn: "7d" });

router.get("/health", (_req, res) => res.json({ status: "ok", service: "unfazed-api" }));

router.post("/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ message: "Name, email and password (8+ characters) are required" });
    if (await Therapist.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: "Email already registered" });
    const base = slugify(name) || "therapist";
    let slug = base, n = 1;
    while (await Therapist.findOne({ slug })) slug = `${base}-${++n}`;
    const user = await Therapist.create({ name, email, passwordHash: await bcrypt.hash(password, 12), slug });
    res.status(201).json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, slug: user.slug, tier: user.tier } });
  } catch (e) { next(e); }
});
router.post("/auth/login", async (req, res, next) => {
  try {
    const user = await Therapist.findOne({ email: String(req.body.email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || "", user.passwordHash))) return res.status(401).json({ message: "Incorrect email or password" });
    res.json({ token: tokenFor(user), user: { id: user._id, name: user.name, email: user.email, slug: user.slug, tier: user.tier } });
  } catch (e) { next(e); }
});

router.get("/public/:slug", async (req, res, next) => {
  try {
    const user = await Therapist.findOne({ slug: req.params.slug }).select("name slug bio specializations languages");
    if (!user) return res.status(404).json({ message: "Therapist not found" });
    const slots = await Slot.find({ therapistId: user._id, isBooked: false, start: { $gte: new Date() } }).sort({ start: 1 }).limit(30);
    res.json({ therapist: user, slots });
  } catch (e) { next(e); }
});
router.post("/public/:slug/book", async (req, res, next) => {
  try {
    const therapist = await Therapist.findOne({ slug: req.params.slug });
    const { slotId, clientName, clientEmail } = req.body;
    if (!therapist || !slotId || !clientName || !clientEmail) return res.status(400).json({ message: "Complete all booking fields" });
    const slot = await Slot.findOneAndUpdate({ _id: slotId, therapistId: therapist._id, isBooked: false, start: { $gte: new Date() } }, { isBooked: true }, { new: true });
    if (!slot) return res.status(409).json({ message: "This slot is no longer available" });
    const booking = await Booking.create({ therapistId: therapist._id, slotId, clientName, clientEmail });
    res.status(201).json({ message: "Booking confirmed", booking });
  } catch (e) { next(e); }
});

router.get("/profile", auth, async (req, res, next) => {
  try {
    const user = await Therapist.findById(req.user.id).select("-passwordHash");
    res.json(user);
  } catch (e) { next(e); }
});
router.put("/profile", auth, async (req, res, next) => {
  try {
    const allowed = { bio: req.body.bio, specializations: req.body.specializations, languages: req.body.languages };
    const user = await Therapist.findByIdAndUpdate(req.user.id, { $set: allowed }, { new: true, runValidators: true }).select("-passwordHash");
    res.json(user);
  } catch (e) { next(e); }
});

router.get("/clients", auth, requireFeature("clients"), async (req, res, next) => {
  try { res.json(await Client.find({ therapistId: req.user.id }).sort({ createdAt: -1 })); } catch (e) { next(e); }
});
router.post("/clients", auth, requireFeature("clients"), async (req, res, next) => {
  try {
    if (!req.body.name) return res.status(400).json({ message: "Client name is required" });
    if (await clientLimitReached(req.user.id)) return res.status(403).json({ message: "Client limit reached. Upgrade your plan." });
    const client = await Client.create({ therapistId: req.user.id, name: req.body.name, email: req.body.email, phone: req.body.phone, tags: req.body.tags || [], consentAt: req.body.consent ? new Date() : undefined });
    res.status(201).json(client);
  } catch (e) { next(e); }
});
router.delete("/clients/:id", auth, async (req, res, next) => {
  try {
    const result = await Client.findOneAndUpdate({ _id: req.params.id, therapistId: req.user.id }, { status: "archived" }, { new: true });
    if (!result) return res.status(404).json({ message: "Client not found" });
    res.json(result);
  } catch (e) { next(e); }
});

router.get("/availability", auth, async (req, res, next) => {
  try { res.json(await Slot.find({ therapistId: req.user.id }).sort({ start: 1 })); } catch (e) { next(e); }
});
router.post("/availability", auth, async (req, res, next) => {
  try {
    const start = new Date(req.body.start), end = new Date(req.body.end);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start || start <= new Date()) return res.status(400).json({ message: "Choose a valid future start and end time" });
    const overlap = await Slot.findOne({ therapistId: req.user.id, start: { $lt: end }, end: { $gt: start } });
    if (overlap) return res.status(409).json({ message: "This time overlaps an existing slot" });
    res.status(201).json(await Slot.create({ therapistId: req.user.id, start, end }));
  } catch (e) { next(e); }
});
router.get("/bookings", auth, async (req, res, next) => {
  try { res.json(await Booking.find({ therapistId: req.user.id }).populate("slotId").sort({ createdAt: -1 })); } catch (e) { next(e); }
});

router.get("/notes/:clientId", auth, async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.clientId, therapistId: req.user.id });
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(await SessionNote.find({ therapistId: req.user.id, clientId: client._id }).sort({ createdAt: -1 }));
  } catch (e) { next(e); }
});
router.post("/notes", auth, async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.body.clientId, therapistId: req.user.id });
    if (!client || !req.body.content) return res.status(400).json({ message: "Valid client and note content are required" });
    const visibility = req.body.visibility === "shared" ? "shared" : "private";
    res.status(201).json(await SessionNote.create({ therapistId: req.user.id, clientId: client._id, content: req.body.content, visibility }));
  } catch (e) { next(e); }
});
// Client-facing notes endpoint: intentionally returns shared notes only.
router.get("/public/:slug/notes/:clientEmail", async (req, res, next) => {
  try {
    const therapist = await Therapist.findOne({ slug: req.params.slug });
    if (!therapist) return res.status(404).json({ message: "Therapist not found" });
    const client = await Client.findOne({ therapistId: therapist._id, email: req.params.clientEmail });
    if (!client) return res.status(404).json({ message: "Client not found" });
    res.json(await SessionNote.find({ therapistId: therapist._id, clientId: client._id, visibility: "shared" }).select("content createdAt"));
  } catch (e) { next(e); }
});

router.get("/payments", auth, async (req, res, next) => {
  try { res.json(await Payment.find({ therapistId: req.user.id }).populate("clientId", "name").sort({ createdAt: -1 })); } catch (e) { next(e); }
});
router.post("/payments", auth, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a valid amount" });
    if (req.body.clientId && !(await Client.findOne({ _id: req.body.clientId, therapistId: req.user.id }))) return res.status(404).json({ message: "Client not found" });
    const payment = await Payment.create({ therapistId: req.user.id, clientId: req.body.clientId || undefined, amount, description: req.body.description || "Session payment", status: "paid", gateway: "demo", transactionId: `DEMO-${Date.now()}` });
    res.status(201).json({ message: "Demo payment recorded (no money was charged)", payment });
  } catch (e) { next(e); }
});

router.get("/chat", auth, requireFeature("chat"), async (req, res, next) => {
  try { res.json(await Message.find({ therapistId: req.user.id }).sort({ createdAt: 1 }).limit(100)); } catch (e) { next(e); }
});
router.post("/chat", auth, requireFeature("chat"), async (req, res, next) => {
  try {
    if (!req.body.message) return res.status(400).json({ message: "Message is required" });
    res.status(201).json(await Message.create({ therapistId: req.user.id, sender: "Therapist", clientName: req.body.clientName || "Client", message: String(req.body.message).slice(0, 2000) }));
  } catch (e) { next(e); }
});

router.get("/analytics", auth, requireFeature("analytics"), async (req, res, next) => {
  try {
    const [clients, bookings, paid] = await Promise.all([
      Client.countDocuments({ therapistId: req.user.id, status: "active" }),
      Booking.countDocuments({ therapistId: req.user.id }),
      Payment.aggregate([{ $match: { therapistId: new (await import("mongoose")).default.Types.ObjectId(req.user.id), status: "paid" } }, { $group: { _id: null, revenue: { $sum: "$amount" } } }])
    ]);
    res.json({ activeClients: clients, bookings, revenue: paid[0]?.revenue || 0 });
  } catch (e) { next(e); }
});

router.get("/subscription", auth, async (req, res, next) => {
  try {
    const user = await Therapist.findById(req.user.id).select("tier");
    res.json({ tier: user.tier, tiers: [{ name: "free", activeClients: 10 }, { name: "pro", activeClients: 100 }, { name: "premium", activeClients: 10000 }] });
  } catch (e) { next(e); }
});
router.put("/subscription", auth, async (req, res, next) => {
  try {
    const tier = ["free", "pro", "premium"].includes(req.body.tier) ? req.body.tier : null;
    if (!tier) return res.status(400).json({ message: "Invalid subscription tier" });
    const user = await Therapist.findByIdAndUpdate(req.user.id, { tier }, { new: true }).select("tier");
    res.json({ message: "Demo tier updated", tier: user.tier });
  } catch (e) { next(e); }
});

app.use("/api", router);
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: "That value is already in use" });
  res.status(500).json({ message: "Server error", detail: process.env.NODE_ENV === "development" ? err.message : undefined });
});
export default app;
