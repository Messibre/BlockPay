
import { resolvePlutusScriptAddress } from "@meshsdk/core";
import { contractScript } from "./src/constants/script.js";

const script = {
  code: contractScript.cbor,
  version: "V2"
};

console.log("Testing with script object:", script);

try {
  const result = resolvePlutusScriptAddress(script, 0);
  console.log("Type of result:", typeof result);
  console.log("Result:", result);
  
  if (typeof result === 'object') {
     console.log("Address:", result.address);
     console.log("Integrity:", result.scriptIntegrity || result.integrity);
  }
} catch (error) {
  console.error("Error resolving script:", error);
}
