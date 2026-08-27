"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import { createSession, deleteSession } from "./session"

export async function login(
  _prev: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const email = (formData.get("email") as string).trim().toLowerCase()
  const password = formData.get("password") as string

  if (!email || !password) return "Todos los campos son requeridos"

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user || !user.active || !user.passwordHash) {
    return "Credenciales inválidas"
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return "Credenciales inválidas"

  await createSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })

  redirect("/dashboard")
}

export async function logout(): Promise<void> {
  await deleteSession()
  redirect("/login")
}
