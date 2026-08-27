"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"
import bcrypt from "bcryptjs"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"
import type { UserRole } from "@/types/users"

interface UserData {
  name: string
  email: string
  role: UserRole
  active: boolean
  password: string
}

interface UpdateData {
  name: string
  email: string
  role: UserRole
  active: boolean
  password?: string
}

async function requireManage() {
  const session = await getSession()
  if (!session || !canManageUsers(session)) {
    throw new Error("No tenés permisos para administrar usuarios")
  }
}

export async function createUser(data: UserData) {
  await requireManage()
  const passwordHash = await bcrypt.hash(data.password, 12)
  await db.insert(users).values({
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active,
    passwordHash,
  })
  refresh()
}

export async function updateUser(id: string, data: UpdateData) {
  await requireManage()
  const update: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    role: data.role,
    active: data.active,
    updatedAt: new Date(),
  }
  if (data.password) {
    update.passwordHash = await bcrypt.hash(data.password, 12)
  }
  await db.update(users).set(update).where(eq(users.id, id))
  refresh()
}

export async function toggleUserActive(id: string, active: boolean) {
  await requireManage()
  await db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, id))
  refresh()
}
