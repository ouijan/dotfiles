/**
 * Regression guard for the crash where a rendered line outgrew the terminal
 * and pi tore down the TUI. Run it after touching any width maths:
 *
 *   npx tsx weave/lib/width.check.ts
 *
 * Not an extension entry point; pi only loads top-level extension modules.
 */
import { truncateText, visibleWidth } from "./format.ts";
import { minimizedLine, DEFAULT_MINIMIZED_FORMAT } from "../tools/groups.ts";

const theme = {
  fg: (_c: string, t: string) => `\u001b[38;2;1;2;3m${t}\u001b[39m`,
  getFgAnsi: () => "\u001b[38;2;9;9;9m",
  italic: (t: string) => `\u001b[3m${t}\u001b[23m`,
};

const samples = [
  "plain ascii thinking text that goes on and on and on for quite a while",
  "🔧🔧🔧 emoji heavy 👨‍👩‍👧‍👦 family zwj and 🇬🇧 flag and é combining",
  "日本語のテキストはとても幅が広いのでこれは重要なテストケースです",
  "mixed 中文 and ascii 🚀 tail",
  "短",
];

let failures = 0;
for (const text of samples) {
  for (const mode of ["tail", "head", "shorten"] as const) {
    for (let width = 1; width <= 40; width++) {
      const out = truncateText(text, width, mode);
      if (visibleWidth(out) > width) {
        failures++;
        console.log(`FAIL truncate ${mode} w=${width} got=${visibleWidth(out)} ${JSON.stringify(out)}`);
      }
    }
  }
}

for (const thinking of samples) {
  for (let width = 20; width <= 120; width++) {
    for (const tools of ["bash", "bash×2 read×12 日本"]) {
      const line = minimizedLine(DEFAULT_MINIMIZED_FORMAT, {
        count: "12", plural: "s", tools, errors: "", thinking,
      }, theme, width);
      if (visibleWidth(line) > width) {
        failures++;
        console.log(`FAIL line w=${width} got=${visibleWidth(line)} ${JSON.stringify(line)}`);
      }
    }
  }
}
console.log(failures === 0 ? "ALL OK" : `${failures} failures`);
