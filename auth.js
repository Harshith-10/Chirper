// auth.js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export async function registerUser(name, password, role) {
  const hash = await bcrypt.hash(password, 12);
  // save { name, hash, role } to DB...
}

export function authMiddleware(socket, next) {
  const token = socket.handshake.auth.token;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error("Authentication error"));
  }
}
