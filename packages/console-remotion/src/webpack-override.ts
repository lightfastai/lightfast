import type { WebpackOverrideFn } from "@remotion/bundler";

export const enableCssLoaders: WebpackOverrideFn = (currentConfig) => ({
  ...currentConfig,
  module: {
    ...currentConfig.module,
    rules: [
      // Remove Remotion's built-in CSS rule to avoid double-processing
      ...(currentConfig.module?.rules ?? []).filter((rule) => {
        if (rule && typeof rule === "object" && "test" in rule && rule.test instanceof RegExp) {
          return !rule.test.test(".css");
        }
        return true;
      }),
      {
        test: /\.css$/i,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: { "@tailwindcss/postcss": {} },
              },
            },
          },
        ],
      },
    ],
  },
});
