import typescript from "@rollup/plugin-typescript";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";

const minifiedLux = (file, polyfills) => ({
  file,
  format: "iife",
  plugins: [
    replace({
      __ENABLE_POLYFILLS: JSON.stringify(polyfills),
    }),
    terser(),
  ],
  sourcemap: true,
});

export default [
  {
    input: "src/lux.ts",
    output: [
      {
        file: "dist/lux.js",
        format: "iife",
        sourcemap: true,
      },
      minifiedLux("dist/lux.min.js", true),
      minifiedLux("dist/lux-no-polyfills.min.js", false),
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
