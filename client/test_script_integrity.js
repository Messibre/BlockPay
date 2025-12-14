
import { resolvePlutusScriptAddress } from "@meshsdk/core";
import { contractScript } from "./src/constants/script.js";

console.log("CBOR length:", contractScript.cbor.length);
try {
  const result = resolvePlutusScriptAddress(contractScript.cbor, 0); // 0 for Testnet
  console.log("Type of result:", typeof result);
  console.log("Result:", result);
  
  if (typeof result === 'object') {
     console.log("Address:", result.address);
     console.log("Integrity:", result.integrity);
  }
} catch (error) {
  console.error("Error resolving script:", error);
}
