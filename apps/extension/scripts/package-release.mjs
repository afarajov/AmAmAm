import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const releaseRoot = resolve(root, "release");
const artifact = resolve(releaseRoot, "contextlayer-extension");
const requiredFiles = ["manifest.json", "background.js", "content.js"];
const forbiddenName = /(?:\.map$|^\.env(?:\.|$)|test|spec|secret)/i;

const manifest = JSON.parse(await readFile(resolve(dist, "manifest.json"), "utf8"));
const contentBundle = await readFile(resolve(dist, "content.js"), "utf8");
if (manifest.manifest_version !== 3) throw new Error("Release manifest must use Manifest V3.");
if (JSON.stringify(manifest).includes("OPENAI_API_KEY")) throw new Error("Release manifest contains a forbidden credential name.");
if (!contentBundle.includes("API mode") || contentBundle.includes("Mock mode")) {
  throw new Error("Production content bundle is not isolated from mock mode.");
}
if (JSON.stringify(manifest.permissions) !== JSON.stringify(["activeTab", "scripting", "storage"])) {
  throw new Error("Release permissions differ from the approved minimal set.");
}
if (!Array.isArray(manifest.host_permissions) || manifest.host_permissions.length !== 1) {
  throw new Error("Release manifest must contain exactly one API host permission.");
}
const permissionUrl = new URL(manifest.host_permissions[0].replace(/\/\*$/, "/"));
if (!["http:", "https:"].includes(permissionUrl.protocol)) {
  throw new Error("Release API host permission must use HTTP(S).");
}

const files = await readdir(dist);
for (const required of requiredFiles) {
  if (!files.includes(required)) throw new Error(`Release is missing ${required}.`);
}
if (files.some((file) => forbiddenName.test(file))) {
  throw new Error("Release output contains a source map, test, environment or secret file.");
}

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });
await cp(dist, artifact, { recursive: true });
console.log(`Release artifact: ${artifact}`);
