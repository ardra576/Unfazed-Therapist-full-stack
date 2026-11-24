import jwt from "jsonwebtoken";
export function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Login required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "development_secret");
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
