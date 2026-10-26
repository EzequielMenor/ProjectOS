import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { listBackups, saveBackupToDisk } from "@/server/services/backup";
import { runAutoBackup } from "@/server/services/auto-backup";
import { createProject } from "@/server/services/projects";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "projectos-auto-"));
process.env.BACKUP_DIR = dir;

const names = () => listBackups().map((b) => b.name);
const age = (name: string, hours: number) => {
  const t = new Date(Date.now() - hours * 3_600_000);
  fs.utimesSync(path.join(dir, name), t, t);
};

describe("automatic backups", () => {
  it("does not copy an empty database", async () => {
    expect(await runAutoBackup()).toEqual({ skipped: "empty" });
    expect(names()).toEqual([]);
  });

  describe("with data", () => {
    beforeAll(async () => {
      await createProject({ identifier: "AUT", name: "Auto" });
    });

    it("takes one copy, then waits until it is old enough", async () => {
      const first = await runAutoBackup();
      expect(path.basename((first as { saved: string }).saved)).toMatch(/^auto-.*\.json$/);
      expect(await runAutoBackup()).toEqual({ skipped: "recent" });
      expect(names()).toHaveLength(1);
      const copy = JSON.parse(fs.readFileSync(path.join(dir, names()[0]), "utf8"));
      expect(copy.format).toBe("projectos-backup");
      expect(copy.counts.project).toBe(1);

      age(names()[0], 21);
      expect(await runAutoBackup()).toMatchObject({ pruned: 0 });
      expect(names()).toHaveLength(2);
    });

    it("keeps only the newest N automatic copies and never deletes manual ones", async () => {
      await saveBackupToDisk("manual");
      for (let i = 0; i < 4; i++) {
        const f = names().find((n) => n.startsWith("auto-") && fs.statSync(path.join(dir, n)).mtimeMs > Date.now() - 3 * 3_600_000);
        if (f) age(f, 22 + i); // make the newest one old enough for another round
        await new Promise((r) => setTimeout(r, 5)); // distinct timestamps in the names
        await runAutoBackup({ keep: 3 });
      }
      const autos = names().filter((n) => n.startsWith("auto-"));
      expect(autos).toHaveLength(3);
      expect(names().filter((n) => n.startsWith("manual-"))).toHaveLength(1);
    });
  });
});
