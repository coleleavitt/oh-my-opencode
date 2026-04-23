import type { Confidence, PLevel } from "../../config/schema/argus-auto-review";
import type { ParsedFinding } from "./types";

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
  certain: 3,
};

const FINDING_HEADER = /^##\s+Finding\s+#(\d+):\s*(.+)$/m;
const PRIORITY_LINE = /\*\*Priority\*\*:\s*(P-[1-4])\s*\((\w+)\)/;
const METRIC_LINE =
  /^-\s+(\w[\w\s]*?):\s*(?:[\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{26AA}\u{1F535}]\s*)?([\w][\w-]*)(?:\s+[—\-]+\s+(.*))?$/mu;
const LOCATION_LINE = /\*\*Location\*\*:\s*`([^`]+)`/;
const SECTION_PATTERN =
  /\*\*(Issue|Recommendation|Rationale)\*\*:\s*([\s\S]*?)(?=\n\*\*(?:Issue|Recommendation|Rationale|Location|Priority|Metrics)\*\*|\n---|\n##\s|$)/g;

function extractMetrics(
  block: string,
): Pick<
  ParsedFinding,
  "impact" | "trigger" | "blastRadius" | "fixEffort" | "confidence"
> {
  const result = {
    impact: "",
    trigger: "",
    blastRadius: "",
    fixEffort: "",
    confidence: "" as Confidence,
  };

  const metricMap: Record<string, keyof typeof result> = {
    impact: "impact",
    trigger: "trigger",
    "blast radius": "blastRadius",
    "fix effort": "fixEffort",
    confidence: "confidence",
  };

  for (const line of block.split("\n")) {
    const match = METRIC_LINE.exec(line);
    if (!match) continue;

    const label = match[1].trim().toLowerCase();
    const value = match[2].trim().toUpperCase();
    const key = metricMap[label];
    if (!key) continue;

    if (key === "confidence") {
      result.confidence = value.toLowerCase() as Confidence;
    } else {
      result[key] = value;
    }
  }

  return result;
}

function extractSections(
  block: string,
): Pick<ParsedFinding, "issue" | "recommendation" | "rationale"> {
  const result: Pick<ParsedFinding, "issue" | "recommendation" | "rationale"> =
    { issue: "" };

  const sectionMap: Record<string, keyof typeof result> = {
    Issue: "issue",
    Recommendation: "recommendation",
    Rationale: "rationale",
  };

  let match: RegExpExecArray | null;
  const re = new RegExp(SECTION_PATTERN.source, SECTION_PATTERN.flags);
  while ((match = re.exec(block)) !== null) {
    const key = sectionMap[match[1]];
    if (key) {
      result[key] = match[2].trim();
    }
  }

  return result;
}

export function parseArgusFindings(text: string): ParsedFinding[] {
  if (!text.trim()) return [];

  const headerSplit = text.split(/(?=^##\s+Finding\s+#?\d+:)/m);
  const blocks =
    headerSplit.length > 1 ? headerSplit : text.split(/\n---\n/);
  const findings: ParsedFinding[] = [];

  for (const block of blocks) {
    const headerMatch = FINDING_HEADER.exec(block);
    if (!headerMatch) continue;

    const priorityMatch = PRIORITY_LINE.exec(block);
    if (!priorityMatch) continue;

    const locationMatch = LOCATION_LINE.exec(block);
    const metrics = extractMetrics(block);
    const sections = extractSections(block);

    findings.push({
      number: Number.parseInt(headerMatch[1], 10),
      title: headerMatch[2].trim(),
      priority: priorityMatch[1] as PLevel,
      priorityLabel: priorityMatch[2].toUpperCase(),
      ...metrics,
      location: locationMatch?.[1] ?? "",
      ...sections,
      raw: block.trim(),
    });
  }

  return findings;
}

export function shouldBlock(
  findings: ParsedFinding[],
  blockOnPLevels: readonly PLevel[],
): boolean {
  return findings.some((f) => blockOnPLevels.includes(f.priority));
}

export function formatBlockMessage(findings: ParsedFinding[]): string {
  const lines = [
    `Argus code review blocked commit: found ${findings.length} issue${findings.length === 1 ? "" : "s"} at blocking P-levels.`,
    "",
  ];

  for (const f of findings) {
    lines.push(`${f.priority} Finding #${f.number}: ${f.title}`);
    lines.push(`  Location: ${f.location}`);
    lines.push(`  Issue: ${f.issue}`);
    lines.push("");
  }

  lines.push(
    "Bypass with `git commit --no-verify` if you understand the risk.",
  );

  return lines.join("\n");
}

export function filterByConfidence(
  findings: ParsedFinding[],
  threshold: Confidence,
): ParsedFinding[] {
  const thresholdLevel = CONFIDENCE_ORDER[threshold];
  return findings.filter(
    (f) => CONFIDENCE_ORDER[f.confidence] >= thresholdLevel,
  );
}
