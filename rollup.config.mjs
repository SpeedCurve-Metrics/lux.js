import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const outputConfig = (file, polyfills, minified) => ({
  file,
  format: "iife",
  plugins: [
    replace({
      __ENABLE_POLYFILLS: JSON.stringify(polyfills),
    }),
    minified ? terser() : undefined,
  ],
  sourcemap: true,
});

export default [
  {
    input: "src/lux.ts",
    output: [
      outputConfig("dist/lux.js", true, false),
      outputConfig("dist/lux.min.js", true, true),
      outputConfig("dist/lux-no-polyfills.js", false, false),
      outputConfig("dist/lux-no-polyfills.min.js", false, true),
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
      strict: false,
      plugins: [
        terser(),

        /**
         * This is a bit of a hack to ensure that the named export is always in the global scope.
         * Rollup formats the export as `var [name] = function() { [default export] }()`, which
         * is fine when the snippet is placed in the global scope. However our customers may either
         * purposefully or inadvertently place the snippet in a scoped block that results in the
         * `LUX` variable not being declared in the global scope. To ensure `LUX` is always in the
         * global scope, we use the replace plugin to remove the `var` from the minified snippet.
         */
        replace({ "var LUX=": "LUX=" }),
      ],
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
        include: ["docs/**", "src/**", "tests/helpers/lux.ts"],
        declaration: false,
      }),
    ],
  },
];
