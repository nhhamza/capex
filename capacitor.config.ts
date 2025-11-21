import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gestion.inmobiliaria",
  appName: "Gestion Inmobiliaria",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
