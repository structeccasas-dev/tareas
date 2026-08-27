"use client"

import dynamic from "next/dynamic"

const PushOptIn = dynamic(() => import("./PushOptIn"), { ssr: false })

export function PushOptInLoader() {
  return <PushOptIn />
}
