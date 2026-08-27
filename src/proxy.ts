import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

function getSecret() {
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error("SESSION_SECRET is not set")
  return new TextEncoder().encode(raw)
}

async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    return true
  } catch {
    return false
  }
}

const PUBLIC_PATHS = ["/login"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isLoginPage = pathname === "/login"
  const isPublicPage = PUBLIC_PATHS.includes(pathname)
  const token = request.cookies.get("session")?.value
  const authenticated = token ? await verifySession(token) : false

  if (!authenticated && !isPublicPage) {
    const url = new URL("/login", request.url)
    return NextResponse.redirect(url)
  }

  if (authenticated && isLoginPage) {
    const url = new URL("/dashboard", request.url)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
