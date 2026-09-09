import { asc, count, ilike, or } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import type { User, UsersPage } from "@/types/users"

// Lista completa — la usan selectores que necesitan elegir entre todos los
// usuarios (ej. agregar miembros a un equipo), no una tabla paginada.
export async function getUsers(): Promise<User[]> {
  try {
    return await db.select().from(users).orderBy(asc(users.createdAt))
  } catch {
    return []
  }
}

const PAGE_LIMIT = 20

export async function getUsersPage(opts: { page: number; search?: string }): Promise<UsersPage> {
  const empty: UsersPage = { users: [], total: 0, page: 1, totalPages: 1 }
  try {
    const page = Math.max(1, opts.page)
    const s = opts.search?.trim()
    const offset = (page - 1) * PAGE_LIMIT

    const whereClause = s ? or(ilike(users.name, `%${s}%`), ilike(users.email, `%${s}%`)) : undefined

    const [rows, [countRow]] = await Promise.all([
      db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(asc(users.createdAt))
        .limit(PAGE_LIMIT)
        .offset(offset),
      db.select({ value: count() }).from(users).where(whereClause),
    ])

    const total = Number(countRow?.value ?? 0)
    return { users: rows, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)) }
  } catch {
    return empty
  }
}
