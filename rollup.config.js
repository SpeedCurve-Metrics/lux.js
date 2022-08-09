import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default [
  {
    input: "src/lux.ts",
    output: [
      {
        file: "dist/lux.js",
        format: "iife",
        sourcemap: true,
      },
      {
        file: "dist/lux.min.js",
        format: "iife",
        plugins: [terser()],
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        include: "src/**",
      }),
    ],
  },

  {
    input: "src/snippet.ts",
    output: {
      file: "dist/lux-snippet.js",
      name: "LUX",
      format: "iife",
      plugins: [terser()],
    },
    plugins: [
      typescript({
        include: ["src/**"],
      }),
    ],
  },

  {
    input: "docs/debug-parser/index.ts",
    output: {
      file: "docs/debug-parser.js",
      format: "iife",
      plugins: [terser()],
    },
    plugins: [
      typescript({
        include: ["docs/**", "src/**"],
        declaration: false,
      }),
    ],
  },
];
