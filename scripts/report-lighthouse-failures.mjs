import { readFile } from "node:fs/promises";

const resultsPath = new URL(
  "../.lighthouseci/assertion-results.json",
  import.meta.url,
);

function escapeWorkflowCommand(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

try {
  const results = JSON.parse(await readFile(resultsPath, "utf8"));
  const failures = results.filter(
    (result) => !result.passed && result.level === "error",
  );

  if (failures.length === 0) {
    console.log(
      "::error title=Lighthouse CI::The command failed without a saved score assertion.",
    );
  }

  for (const failure of failures) {
    const title = escapeWorkflowCommand(
      `Lighthouse: ${failure.auditId ?? "unknown audit"}`,
    );
    const message = escapeWorkflowCommand(
      `${failure.url ?? "unknown URL"} expected ${failure.operator ?? ""}${
        failure.expected
      }, found ${failure.actual}. ${failure.message ?? ""}`.trim(),
    );
    console.log(`::error title=${title}::${message}`);
  }
} catch (error) {
  console.log(
    `::error title=Lighthouse CI diagnostics::${escapeWorkflowCommand(
      error instanceof Error ? error.message : String(error),
    )}`,
  );
}
