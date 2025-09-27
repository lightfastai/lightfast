/** @type {import("@babel/core").ConfigFunction} */
module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
          root: ["./src"],
          alias: {
            "@": "./src",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
