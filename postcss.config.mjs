import dropRemoteImports from "./scripts/postcss-drop-remote-imports.mjs";

const config = {
  plugins: [
    "@tailwindcss/postcss",
    dropRemoteImports(),
  ],
};

export default config;
