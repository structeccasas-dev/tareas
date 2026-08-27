"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"
import bcrypt from "bcryptjs"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import { getSession, createSession } from "@/lib/session"

async function requireSession() {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")
  return session
}

export async function updateOwnProfile(data: { name: string }) {
  const session = await requireSession()
  const name = data.name.trim()
  if (!name) throw new Error("El nombre no puede estar vacío")

  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, session.userId))

  // La sesión guarda el nombre en el JWT: hay que reemitirla para que quede al día.
  await createSession({ userId: session.userId, name, email: session.email, role: session.role })

  refresh()
}

export async function changeOwnPassword(data: { currentPassword: string; newPassword: string }) {
  const session = await requireSession()
  if (data.newPassword.length < 8) {
    throw new Error("La nueva contraseña debe tener al menos 8 caracteres")
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  if (!user) throw new Error("Usuario no encontrado")

  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash)
  if (!valid) throw new Error("La contraseña actual es incorrecta")

  const passwordHash = await bcrypt.hash(data.newPassword, 12)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, session.userId))
}
