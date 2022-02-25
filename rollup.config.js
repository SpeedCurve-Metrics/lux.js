import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: "src/lux.ts",
    output: [
      {
        file: "dist/lux.js",
        format: "iife",
      },
      {
        file: "dist/lux.min.js",
        format: "iife",
        plugins: [terser()],
      },
    ],
    plugins: [
      typescript({
        include: "src/**",
      }),
    ],
  },
  {
    input: "docs/debug-parser.ts",
    output: {
      file: "docs/debug-parser.js",
      format: "iife",
      plugins: [terser()],
    },
    plugins: [
      typescript({
        include: ["docs/**", "src/**"],
      }),
    ],
  },
];
