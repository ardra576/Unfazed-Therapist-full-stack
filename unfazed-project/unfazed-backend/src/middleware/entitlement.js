import { Therapist, Client } from "../models/Models.js";
const defaults = {
  free: { activeClients: 10, features: ["profile", "clients", "booking", "notes", "payments"] },
  pro: { activeClients: 100, features: ["profile", "clients", "booking", "notes", "payments", "analytics", "chat"] },
  premium: { activeClients: 10000, features: ["profile", "clients", "booking", "notes", "payments", "analytics", "chat", "exports"] }
};
export async function canAccess(therapistId, featureKey) {
  const therapist = await Therapist.findById(therapistId);
  if (!therapist) return false;
  const tier = defaults[therapist.tier] || defaults.free;
  return tier.features.includes(featureKey);
}
export async function requireFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (!(await canAccess(req.user.id, featureKey))) {
        return res.status(403).json({ message: `Upgrade your plan to access ${featureKey}`, upgradeRequired: true });
      }
      next();
    } catch (error) { next(error); }
  };
}
export async function clientLimitReached(therapistId) {
  const therapist = await Therapist.findById(therapistId);
  const tier = defaults[therapist?.tier] || defaults.free;
  const count = await Client.countDocuments({ therapistId, status: "active" });
  return count >= tier.activeClients;
}
