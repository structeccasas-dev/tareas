import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import { getSession } from "@/lib/session"
import type { OwnProfile, SessionUserSummary } from "@/types/users"

export async function getOwnProfile(): Promise<OwnProfile | null> {
  try {
    const session = await getSession()
    if (!session) return null

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
    return user ?? null
  } catch {
    return null
  }
}

export async function getSessionUserSummary(): Promise<SessionUserSummary | null> {
  try {
    const session = await getSession()
    if (!session) return null
    const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, session.userId)).limit(1)
    return user ?? null
  } catch {
    return null
  }
}
