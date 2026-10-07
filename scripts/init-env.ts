// Complete .env without replacing existing credentials. Secrets are only written to disk.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

const template = readFileSync(".env.example", "utf8");
const existing = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const values = parseEnv(existing);
const secrets: Record<string, number> = { ADMIN_PASSWORD: 18, SESSION_SECRET: 32, IMG_PROXY_SIGN_SECRET: 32, POSTGRES_PASSWORD: 18 };
let text = existing;
for (const [key, fallback] of Object.entries(parseEnv(template))) {
  if (values[key] !== undefined && (values[key] !== "" || !secrets[key])) continue;
  const value = secrets[key] ? randomBytes(secrets[key]).toString("hex") : fallback;
  if (values[key] !== undefined) {
    text = text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${JSON.stringify(value)}`);
  } else {
    if (text && !text.endsWith("\n")) text += "\n";
    text += `${key}=${JSON.stringify(value)}\n`;
  }
}
if (text !== existing) writeFileSync(".env", text, { mode: 0o600 });
console.log("本地配置已补齐，已有设置保持不变。管理员密码和 API 密钥仅保存在 .env 中。");
if (!values.OPENAI_API_KEY) console.log("请通过安全配置输入 OPENAI_API_KEY；不要把密钥写进命令参数或聊天。");
