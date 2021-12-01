import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/lux.js",
  output: {
    dir: "dist",
    format: "cjs",
  },
  plugins: [
    typescript({
      include: "src/**",
    }),
  ],
};
