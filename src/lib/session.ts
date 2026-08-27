import "server-only"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { UserRole } from "@/types/users"

export interface SessionPayload {
  userId: string
  name: string
  email: string
  role: UserRole
  expiresAt: Date
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function getSecret() {
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error("SESSION_SECRET is not set")
  return new TextEncoder().encode(raw)
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret())
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(
  data: Omit<SessionPayload, "expiresAt">
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ ...data, expiresAt })
  const cookieStore = await cookies()
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) return null
  return decrypt(token)
}
