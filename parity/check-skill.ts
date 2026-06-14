// Parity gate for the canonical agent skill. Two phases:
//   1. Source-tree diff — assert viewmodel-shell/agent-skill.md and
//      viewmodel-shell-dotnet/AgentSkill.md are byte-identical (catches the
//      .NET twin drifting from the npm source).
//   2. HTTP twin check — GET /.well-known/vms-skill.md against
//      dotnet-helpdesk + bun-helpdesk; assert identical bodies, correct
//      content-type, body contains the HelpDesk preamble substring.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TS_SKILL_PATH = resolve(__dirname, "..", "viewmodel-shell", "agent-skill.md");
const DOTNET_SKILL_PATH = resolve(__dirname, "..", "viewmodel-shell-dotnet", "AgentSkill.md");
const HELPDESK_PREAMBLE_SUBSTRING = "This is a help-desk ticketing app.";
const SKILL_URL_PATH = "/.well-known/vms-skill.md";

/**
 * Phase 1 — diff the two source files on disk. Runs unconditionally; no
 * backend startup needed. On mismatch, prints byte-position of first
 * divergence + the fix command.
 */
export function checkSourceTwins(): void {
  const tsBytes = readFileSync(TS_SKILL_PATH);
  const dotnetBytes = readFileSync(DOTNET_SKILL_PATH);
  if (tsBytes.length !== dotnetBytes.length || !tsBytes.equals(dotnetBytes)) {
    let firstDiff = -1;
    const min = Math.min(tsBytes.length, dotnetBytes.length);
    for (let i = 0; i < min; i++) {
      if (tsBytes[i] !== dotnetBytes[i]) {
        firstDiff = i;
        break;
      }
    }
    throw new Error(
      `Skill source files diverged at byte ${firstDiff === -1 ? "<length mismatch>" : firstDiff}: ` +
        `${TS_SKILL_PATH} (${tsBytes.length}B) vs ${DOTNET_SKILL_PATH} (${dotnetBytes.length}B). ` +
        `Fix: cp ${TS_SKILL_PATH} ${DOTNET_SKILL_PATH}`,
    );
  }
  console.log(`  ✓ skill source files byte-identical (${tsBytes.length}B)`);
}

/**
 * Phase 2 — GET /.well-known/vms-skill.md from every supplied backend; assert
 * status 200, Content-Type starts with text/markdown, bodies are byte-identical,
 * and each body contains the HelpDesk preamble substring (sanity-checks the
 * appPreamble plumbing on both backends).
 */
export async function checkHttpTwins(
  baseUrls: { name: string; url: string }[],
): Promise<void> {
  const bodies: Array<{ name: string; body: string; contentType: string }> = [];
  for (const b of baseUrls) {
    const res = await fetch(`${b.url}${SKILL_URL_PATH}`);
    if (res.status !== 200) {
      throw new Error(
        `${b.name} GET ${SKILL_URL_PATH} returned ${res.status} ${res.statusText}`,
      );
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.toLowerCase().startsWith("text/markdown")) {
      throw new Error(
        `${b.name} GET ${SKILL_URL_PATH} content-type was '${ct}', expected text/markdown*`,
      );
    }
    const body = await res.text();
    if (!body.includes(HELPDESK_PREAMBLE_SUBSTRING)) {
      throw new Error(
        `${b.name} body missing preamble substring '${HELPDESK_PREAMBLE_SUBSTRING}'`,
      );
    }
    bodies.push({ name: b.name, body, contentType: ct });
  }
  if (bodies.length < 2) return; // single backend → nothing to diff
  const ref = bodies[0]!;
  for (let i = 1; i < bodies.length; i++) {
    const other = bodies[i]!;
    if (other.body !== ref.body) {
      throw new Error(
        `Skill body diverged: ${ref.name} (${ref.body.length}B) vs ${other.name} (${other.body.length}B). ` +
          `\n${ref.name} head: ${JSON.stringify(ref.body.slice(0, 200))}` +
          `\n${other.name} head: ${JSON.stringify(other.body.slice(0, 200))}`,
      );
    }
  }
  console.log(
    `  ✓ skill HTTP twins byte-identical (${ref.body.length}B) across ${bodies.length} backends`,
  );
}
