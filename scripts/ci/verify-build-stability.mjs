import { readFileSync } from "node:fs";

const files = process.argv.slice(2);

if (files.length < 3) {
  console.error("Expected at least 3 build metadata files.");
  process.exit(1);
}

const runs = files
  .map((file) => JSON.parse(readFileSync(file, "utf8")))
  .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())
  .slice(0, 3);

const allSuccessful = runs.every((run) => run.status === "success");

if (!allSuccessful) {
  console.error("The latest three build metadata files are not all successful.");
  process.exit(1);
}

console.log("Latest three build metadata files are all successful.");
