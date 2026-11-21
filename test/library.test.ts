import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Session } from "@z/desk";

const root = process.cwd();
const titles = JSON.parse(readFileSync(join(root, "titles.json"), "utf8")).titles as { id: string; label: string }[];

describe("the selected story library", () => {
  for (const title of titles) {
    it(title.label + " has the expected header and reaches the first prompt", () => {
      const files = readdirSync(join(root, "z/historical/games/binaries")).filter((file) => file.startsWith(title.id + "-s") && file.endsWith(".z3"));
      expect(files).toHaveLength(1);
      const relative = "z/historical/games/binaries/" + files[0]!;
      const bytes = readFileSync(join(root, relative));
      const [, release, serial] = /-r(\d+)-s(\d{6})\.z3$/.exec(files[0]!)!;
      expect(bytes[0]).toBe(3);
      expect(bytes.readUInt16BE(2)).toBe(Number(release));
      expect(bytes.subarray(18, 24).toString("ascii")).toBe(serial);
      const session = new Session(new Uint8Array(bytes), { seed: 13 });
      session.start();
      expect(session.stop?.kind).toBe("input");
    });
  }
});
