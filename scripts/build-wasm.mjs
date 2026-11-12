import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const crateDir = path.join(rootDir, "crates", "trace-wasm");
const outDir = path.join(rootDir, "src", "wasm");

console.log("Building crates/trace-wasm -> src/wasm/...");
execSync(`wasm-pack build "${crateDir}" --target web --out-dir "${outDir}" --release`, {
  stdio: "inherit",
  cwd: rootDir,
});

