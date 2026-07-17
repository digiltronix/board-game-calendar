// Mock for firebase/messaging — used when NUXT_PUBLIC_SCREENSHOT_MODE=true.

export function getMessaging(): null {
  return null
}
export async function getToken(): Promise<string> {
  return 'screenshot-mock-fcm-token'
}
export function onMessage(): () => void {
  return () => {}
}
export async function isSupported(): Promise<boolean> {
  return false
}
