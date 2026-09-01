"use client"

import { useEffect, useState } from "react"
import { Bell, Share, X } from "lucide-react"
import { saveSubscription } from "@/modules/notifications/actions/pushActions"

const IOS_HINT_DISMISSED_KEY = "push-ios-install-hint-dismissed"

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

async function subscribe(): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return

  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  await saveSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } })
}

function supportsPush(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  )
}

function isIOSSafariNotInstalled(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (!isIOS) return false
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return !isStandalone
}

export default function PushOptIn() {
  const [visible, setVisible] = useState(() => supportsPush() && Notification.permission === "default")
  const [loading, setLoading] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(
    () => isIOSSafariNotInstalled() && localStorage.getItem(IOS_HINT_DISMISSED_KEY) !== "1"
  )

  useEffect(() => {
    if (supportsPush() && Notification.permission === "granted") {
      subscribe().catch(() => {})
    }
  }, [])

  async function handleEnable() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === "granted") await subscribe()
    } finally {
      setLoading(false)
      setVisible(false)
    }
  }

  function dismissIOSHint() {
    localStorage.setItem(IOS_HINT_DISMISSED_KEY, "1")
    setShowIOSHint(false)
  }

  if (showIOSHint) {
    return (
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 z-40 flex items-start gap-2.5 p-3.5 rounded-xl bg-neutral-900 text-white text-sm shadow-elevation-md print:hidden">
        <Share className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.9} />
        <p className="flex-1">
          Para recibir notificaciones de seguimiento en este iPhone, tocá el botón de compartir{" "}
          <Share className="w-3.5 h-3.5 inline-block align-text-bottom" strokeWidth={1.9} /> y elegí{" "}
          <strong>&quot;Agregar a pantalla de inicio&quot;</strong>. Después abrí la app desde ese ícono.
        </p>
        <button type="button" onClick={dismissIOSHint} className="flex-shrink-0 text-gray-400 hover:text-white">
          <X className="w-4 h-4" strokeWidth={1.9} />
        </button>
      </div>
    )
  }

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={loading}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium shadow-elevation-md hover:bg-primary-hover transition-colors duration-150 disabled:opacity-60 print:hidden"
    >
      <Bell className="w-4 h-4 flex-shrink-0" strokeWidth={1.9} />
      {loading ? "Activando..." : "Activar notificaciones de tareas"}
    </button>
  )
}
