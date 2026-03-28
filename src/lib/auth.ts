import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Simple session token - stored in cookie
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// In-memory session store (for simplicity - use Redis/DB in production)
const sessions = new Map<string, string>(); // token -> userId

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  sessions.set(token, userId);
  const cookieStore = await cookies();
  cookieStore.set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return token;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;

  const userId = sessions.get(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  return user;
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (token) {
    sessions.delete(token);
  }
  cookieStore.delete("session_token");
}
