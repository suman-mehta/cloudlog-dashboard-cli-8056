#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { get } from "node:https";
import { createInterface } from "node:readline";
import { exit } from "node:process";

function printHelp() {
  console.log(`Usage: cloudlog-dashboard --url <logEndpoint> [--output <file>]

Options:
  --url      HTTPS endpoint that streams log lines (required)
  --output   File to write telemetry JSON (default: stdout)
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") {
      result.url = args[i + 1];
      i++;
    } else if (args[i] === "--output") {
      result.output = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      result.help = true;
    }
  }
  return result;
}

async function run() {
  const { url, output, help } = parseArgs();
  if (help || !url) {
    printHelp();
    exit(0);
  }

  const metrics = {
    totalLines: 0,
    errorLines: 0,
    warningLines: 0,
  };

  const req = get(url, (res) => {
    const rl = createInterface({ input: res });
    rl.on("line", (line) => {
      metrics.totalLines++;
      const lower = line.toLowerCase();
      if (lower.includes("error")) metrics.errorLines++;
      if (lower.includes("warning")) metrics.warningLines++;
    });

    rl.on("close", () => {
      const out = JSON.stringify(metrics, null, 2);
      if (output) {
        const outPath = resolve(process.cwd(), output);
        const stream = createWriteStream(outPath);
        stream.write(out);
        stream.end(() => {
          console.log(`Telemetry written to ${outPath}`);
          exit(0);
        });
      } else {
        console.log(out);
        exit(0);
      }
    });
  });

  req.on("error", (err) => {
    console.error(`Failed to fetch logs: ${err.message}`);
    exit(1);
  });
}

run();