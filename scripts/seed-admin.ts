import bcrypt from "bcryptjs"
import { db } from "../src/db"
import { users } from "../src/db/schema/user"

async function main() {
  const NAME = process.env.ADMIN_NAME ?? "Admin"
  const EMAIL = process.env.ADMIN_EMAIL ?? "admin@tareas.com"
  const PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234"

  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  await db.insert(users).values({
    name: NAME,
    email: EMAIL,
    passwordHash,
    role: "admin",
    active: true,
  })

  console.log(`\n✓ Admin user created`)
  console.log(`  Email:    ${EMAIL}`)
  console.log(`  Password: ${PASSWORD}\n`)
  console.log(`  Remember to change the password after first login.\n`)
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err)
  process.exit(1)
})
