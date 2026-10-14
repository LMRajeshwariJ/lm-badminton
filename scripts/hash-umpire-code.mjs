import { createHmac, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const pepper = process.env.UMPIRE_CODE_PEPPER ?? randomBytes(32).toString("hex");
if (pepper.length < 32) throw new Error("UMPIRE_CODE_PEPPER must be at least 32 characters.");

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const code = await terminal.question("Shared umpire access code (not saved to a file): ");
  if (!code || code.length > 128) throw new Error("The access code must contain 1 to 128 characters.");
  const digest = createHmac("sha256", pepper).update(code).digest("hex");
  stdout.write(`UMPIRE_CODE_PEPPER=${pepper}\nUMPIRE_ACCESS_CODE_HASH=${digest}\n`);
} finally {
  terminal.close();
}
