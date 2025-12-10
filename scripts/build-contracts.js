import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contractsDir = join(__dirname, "..", "contracts");

console.log("Building Aiken contracts...");
console.log(`Working directory: ${contractsDir}`);

try {
  execSync("aiken build", {
    cwd: contractsDir,
    stdio: "inherit",
  });
  console.log("✓ Contracts built successfully");
} catch (error) {
  console.error("✗ Build failed:", error.message);
  process.exit(1);
}

