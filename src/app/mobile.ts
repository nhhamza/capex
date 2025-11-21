import { StatusBar, Style } from "@capacitor/status-bar";

export async function applyMobilePolish() {
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    console.log("✅ Mobile polish applied");
  } catch (err) {
    console.log("⚠️ Status bar not available (web mode)");
  }
}
