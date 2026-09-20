import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });
export default [
  { ignores: ["node_modules/**", ".next/**", "output/**", ".astra/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: { "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }] } },
  {
    files: ["components/lab/HumanoidImageStage.tsx", "components/lab/HumanoidLab.tsx", "components/lab/HumanoidLabV3.tsx", "components/lab/HumanoidLabV4.tsx", "components/lab/HumanoidLabV5.tsx", "components/lab/HumanoidLabV6.tsx", "components/lab/HumanoidLabV7b.tsx", "components/lab/HumanoidLabV8.tsx"],
    // Archived visual prototypes predate the current V9 renderer. Keep them
    // buildable without weakening checks for active Brain/runtime code.
    rules: { "@next/next/no-html-link-for-pages": "off", "react/jsx-no-comment-textnodes": "off", "@typescript-eslint/no-explicit-any": "off" },
  },
];
