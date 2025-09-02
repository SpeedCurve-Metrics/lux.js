import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json" with { type: "json" };

const commonPlugins = (target = "es5") => [
  json(),
  replace({
    __ENABLE_POLYFILLS: JSON.stringify(target === "es5"),
  }),
  typescript({
    include: ["src/**"],
    compilerOptions: {
      target,
    },
  }),
];

const scriptOutput = (file, minified) => ({
  file,
  format: "iife",
  plugins: [minified ? terser() : undefined],
  sourcemap: true,
});

const snippetOutput = (file, target) => {
  const versionString = `${pkg.config.snippetVersion}${target === "es5" ? "" : `-${target}`}`;
  const preamble = `/* SpeedCurve RUM Snippet v${versionString} */`;

  return {
    file: file,
    name: "LUX",
    format: "iife",
    strict: false,
    plugins: [
      terser({
        format: {
          preamble: preamble,
        },
      }),

      /**
       * This is a bit of a hack to ensure that the named export is always in the global scope.
       * Rollup formats the export as `var [name] = function() { [default export] }()`, which
       * is fine when the snippet is placed in the global scope. However our customers may either
       * purposefully or inadvertently place the snippet in a scoped block that results in the
       * `LUX` variable not being declared in the global scope. To ensure `LUX` is always in the
       * global scope, we use the replace plugin to remove the `var` from the minified snippet.
       */
      replace({
        delimiters: ["", ""],
        values: {
          "var LUX=": "LUX=",
          [`${preamble}\n`]: preamble,
          __SNIPPET_VERSION: JSON.stringify(versionString),
        },
      }),
    ],
  };
};

export default [
  // lux.js script (compat)
  {
    input: "src/lux.ts",
    output: [scriptOutput("dist/lux.js", false), scriptOutput("dist/lux.min.js", true)],
    plugins: commonPlugins(),
  },

  // lux.js script (ES2015)
  {
    input: "src/lux.ts",
    output: [
      scriptOutput("dist/lux.es2015.js", false),
      scriptOutput("dist/lux.es2015.min.js", true),
    ],
    plugins: commonPlugins("es2015"),
  },

  // lux.js script (ES2020)
  {
    input: "src/lux.ts",
    output: [
      scriptOutput("dist/lux.es2020.js", false),
      scriptOutput("dist/lux.es2020.min.js", true),
    ],
    plugins: commonPlugins("es2020"),
  },

  // Inline snippet (compat)
  {
    input: "src/snippet.ts",
    output: [snippetOutput("dist/lux-snippet.js")],
    plugins: commonPlugins(),
  },

  // Inline snippet (ES2015)
  {
    input: "src/snippet.ts",
    output: [snippetOutput("dist/lux-snippet.es2015.js", "es2015")],
    plugins: commonPlugins("es2015"),
  },

  // Inline snippet (ES2020)
  {
    input: "src/snippet.ts",
    output: [snippetOutput("dist/lux-snippet.es2020.js", "es2020")],
    plugins: commonPlugins("es2020"),
  },

  // Debug parser
  {
    input: "docs/debug-parser/index.ts",
    output: {
      file: "docs/debug-parser.js",
      format: "iife",
      plugins: [terser()],
    },
    plugins: [
      json(),
      typescript({
        include: ["docs/**", "src/**", "tests/helpers/lux.ts"],
        declaration: false,
      }),
    ],
  },
];
