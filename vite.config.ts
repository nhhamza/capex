import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api/catastro": {
        target: "https://ovc.catastro.meh.es",
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p.replace(/^\/api\/catastro/, ""),
      },
    },
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: (id) => {
          // MUI components in separate chunk
          if (id.includes("node_modules/@mui/material")) {
            return "mui-material";
          }
          if (id.includes("node_modules/@mui/icons-material")) {
            return "mui-icons";
          }
          if (id.includes("node_modules/@mui/x-date-pickers")) {
            return "mui-pickers";
          }

          // Firebase in separate chunk
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }

          // Chart.js and related in separate chunk
          if (id.includes("node_modules/chart.js") || id.includes("node_modules/react-chartjs-2")) {
            return "charts";
          }

          // PDF generation libraries
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas")) {
            return "pdf-export";
          }

          // Excel export libraries
          if (id.includes("node_modules/xlsx")) {
            return "excel-export";
          }

          // Dayjs and date utilities
          if (id.includes("node_modules/dayjs")) {
            return "date-utils";
          }

          // Axios and API utilities
          if (id.includes("node_modules/axios")) {
            return "api-utils";
          }

          // React Router
          if (id.includes("node_modules/react-router")) {
            return "react-router";
          }

          // Other large node_modules
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "@mui/material",
      "@mui/icons-material",
      "@mui/x-date-pickers",
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "chart.js",
      "react-chartjs-2",
      "axios",
      "dayjs",
    ],
  },
});
