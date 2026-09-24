import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ID = "dbd0c462-bb32-42be-b174-feb489be9f16";
const ENVIRONMENT = process.env.INFISICAL_ENV ?? "dev";
const BASE = "https://us.infisical.com/api";
const TOKEN = process.env.INFISICAL_TOKEN;
const ROOT = resolve(import.meta.dirname, "..");

if (!TOKEN) {
  console.error("Falta INFISICAL_TOKEN");
  process.exit(1);
}

const res = await fetch(
  `${BASE}/v4/secrets?projectId=${PROJECT_ID}&environment=${ENVIRONMENT}&secretPath=/&viewSecretValue=true&limit=100`,
  { headers: { Authorization: `Bearer ${TOKEN}` } },
);
if (!res.ok) {
  console.error(`Infisical ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { secrets } = await res.json();

const LOCAL_TOOLING = new Set([
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_D1_TOKEN",
  "CLOUDFLARE_D1_DATABASE_ID",
  "KOFI_VERIFICATION_TOKEN",
  "PUBLIC_KOFI_USERNAME",
  "PUBLIC_BINANCE_PAY_ID",
  "PUBLIC_XMR_WALLET",
  "PUBLIC_USDT_TRC20_WALLET",
  "PUBLIC_BTC_WALLET",
  "PUBLIC_ETH_WALLET",
]);

const PUBLIC = /^(PUBLIC_|ADSTERRA_|CONTEXT7_)/;

const buckets = {
  ".env": [],
  ".env.local": [],
  ".dev.vars": [],
};

for (const s of secrets) {
  const key = s.secretKey;
  if (LOCAL_TOOLING.has(key)) buckets[".env.local"].push(key);
  else if (PUBLIC.test(key)) buckets[".env"].push(key);
  else buckets[".dev.vars"].push(key);
}

const valueByKey = Object.fromEntries(secrets.map((s) => [s.secretKey, s.secretValue]));

for (const [file, keys] of Object.entries(buckets)) {
  const path = resolve(ROOT, file);
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {}

  const existing = new Map();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) existing.set(m[1], line);
  }

  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m) {
      const key = m[1];
      if (!keys.includes(key)) {
        out.push(line);
        continue;
      }
      seen.add(key);
      out.push(`${key}=${JSON.stringify(valueByKey[key] ?? "")}`);
    } else {
      out.push(line);
    }
  }
  for (const key of keys) {
    if (!seen.has(key)) out.push(`${key}=${JSON.stringify(valueByKey[key] ?? "")}`);
  }

  writeFileSync(path, out.join("\n").replace(/\n*$/, "\n"));
  console.log(`${file}: ${keys.length} keys`);
}
