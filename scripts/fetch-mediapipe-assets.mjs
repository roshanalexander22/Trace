import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const wasmSrc = path.join(rootDir, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDest = path.join(rootDir, "public", "wasm");
const modelDestDir = path.join(rootDir, "public", "models");
const modelDest = path.join(modelDestDir, "hand_landmarker.task");
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

fs.mkdirSync(wasmDest, { recursive: true });
fs.mkdirSync(modelDestDir, { recursive: true });

if (fs.existsSync(wasmSrc)) {
  for (const file of fs.readdirSync(wasmSrc)) {
    fs.copyFileSync(path.join(wasmSrc, file), path.join(wasmDest, file));
  }
  console.log("Copied MediaPipe WASM files to public/wasm/");
} else {
  console.error("MediaPipe WASM directory not found at:", wasmSrc);
  process.exitCode = 1;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          downloadFile(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        fs.rmSync(dest, { force: true });
        reject(err);
      });
  });
}

if (!fs.existsSync(modelDest) || fs.statSync(modelDest).size < 1_000_000) {
  console.log("Downloading hand_landmarker.task (~7.8 MB) for offline bundle...");
  await downloadFile(modelUrl, modelDest);
  console.log("Saved public/models/hand_landmarker.task");
} else {
  console.log("public/models/hand_landmarker.task already present.");
}

