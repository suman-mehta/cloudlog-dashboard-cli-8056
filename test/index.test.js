import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";

const LOG_DATA = `INFO Service started
WARNING Disk usage high
ERROR Unable to connect to DB
INFO Request processed
ERROR Timeout occurred
`;

test("CLI aggregates log metrics correctly", async (t) => {
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(LOG_DATA);
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}`;

  const outFile = resolve(process.cwd(), "tmp-telemetry.json");
  await rm(outFile, { force: true });

  await new Promise((resolve, reject) => {
    const cli = spawn(process.execPath, [
      resolve(process.cwd(), "src", "index.js"),
      "--url",
      url,
      "--output",
      outFile,
    ]);

    cli.on("error", reject);
    cli.on("close", (code) => {
      if (code !== 0) reject(new Error(`CLI exited with ${code}`));
      else resolve();
    });
  });

  const data = JSON.parse(await readFile(outFile, "utf8"));
  assert.equal(data.totalLines, 5);
  assert.equal(data.errorLines, 2);
  assert.equal(data.warningLines, 1);

  await rm(outFile, { force: true });
  server.close();
});