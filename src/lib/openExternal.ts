import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export async function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    // Open in system browser on mobile
    await Browser.open({ url });
  } else {
    // Open in same window on web
    window.location.href = url;
  }
}
