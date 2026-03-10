import nextVitals from "eslint-config-next/core-web-vitals";
import tailwindcss from "eslint-plugin-tailwindcss";
import tailwindCanonicalClasses from "eslint-plugin-tailwind-canonical-classes";
import path from "node:path";
import { fileURLToPath } from "node:url";

const config = [...nextVitals, ...tailwindcss.configs["flat/recommended"]];

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const tailwindV4CssEntry = path.join(currentDir, "app/globals.css");

config.push({
  settings: {
    tailwindcss: {
      config: tailwindV4CssEntry
    }
  }
});

config.push({
  plugins: {
    "tailwind-canonical-classes": tailwindCanonicalClasses
  },
  rules: {
    "tailwind-canonical-classes/tailwind-canonical-classes": [
      "warn",
      {
        cssPath: tailwindV4CssEntry
      }
    ]
  }
});

export default config;
