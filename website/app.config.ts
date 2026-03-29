import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "styled-system": "/styled-system",
      },
    },
  },
  server: {
    routeRules: {
      "/fonts/**": {
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
        },
      },
    },
  },
});
