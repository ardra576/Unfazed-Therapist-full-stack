import dotenv from "dotenv";
dotenv.config();
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import app from "./src/app.js";

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", methods: ["GET", "POST"] }
});
io.on("connection", socket => {
  socket.on("join-room", room => socket.join(String(room)));
  socket.on("chat-message", payload => {
    if (!payload?.room || !payload?.message) return;
    io.to(String(payload.room)).emit("chat-message", {
      message: String(payload.message).slice(0, 2000),
      sender: String(payload.sender || "User"),
      createdAt: new Date().toISOString()
    });
  });
});

const PORT = process.env.PORT || 5000;
try {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/unfazed");
  console.log("MongoDB connected");
  server.listen(PORT, () => console.log(`API + Socket.IO running on http://localhost:${PORT}`));
} catch (error) {
  console.error("Could not connect to MongoDB. Check MONGO_URI and ensure MongoDB is running.");
  console.error(error.message);
  process.exit(1);
}
