import { asc } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import type { User } from "@/types/users"

export async function getUsers(): Promise<User[]> {
  try {
    return await db.select().from(users).orderBy(asc(users.createdAt))
  } catch {
    return []
  }
}
