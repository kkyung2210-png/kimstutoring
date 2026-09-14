const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const currentPath = path.join(root, "pages.csv");
const defaultBaselinePath = path.join(root, ".backups", "pages.backup.csv");
const requiredColumns = ["slug", "description", "domain", "status", "language", "province", "region", "subject", "keyword", "title"];
const templateColumns = ["template", "search_intent", "summary", "lesson_focus", "lesson_method", "lesson_result", "tone"];
const {TYPES, classifyTopic} = require('./content-intelligence');
const allowedTemplates = new Set(TYPES);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (value.length || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function loadCsv(filePath) {
  const [headerRow, ...rows] = parseCsv(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  const headers = headerRow.map((header) => header.trim());
  return {
    headers,
    rows: rows.map((values, index) => ({
      line: index + 2,
      ...Object.fromEntries(headers.map((header, column) => [header, String(values[column] || "").trim()])),
    })),
  };
}

function identity(row) {
  return [row.province, row.region, row.subject, row.target || ""].join("|");
}

function validate(current, baseline) {
  const errors = [];
  const warnings = [];
  const missingHeaders = requiredColumns.filter((column) => !current.headers.includes(column));
  if (missingHeaders.length) errors.push({ type: "missing-columns", columns: missingHeaders });
  const published = current.rows.filter((row) => row.status.toLowerCase() === "publish");
  const slugLines = new Map();
  const keywordLines = new Map();
  const regionTypes = new Map();
  for (const row of published) {
    try { classifyTopic(row); } catch (error) { errors.push({type:'template-contract',line:row.line,slug:row.slug,message:error.message}); }
    const regionKey = [row.province,row.region].join('|');
    if(!regionTypes.has(regionKey))regionTypes.set(regionKey,[]);
    regionTypes.get(regionKey).push(row.template);
    if(!keywordLines.has(row.keyword))keywordLines.set(row.keyword,[]);
    keywordLines.get(row.keyword).push(row.line);
    const missing = requiredColumns.filter((column) => !row[column]);
    if (missing.length) errors.push({ type: "missing-values", line: row.line, slug: row.slug, columns: missing });
    if (row.template) {
      const missingTemplateValues = templateColumns.filter((column) => !row[column]);
      if (missingTemplateValues.length) errors.push({ type: "missing-template-values", line: row.line, slug: row.slug, columns: missingTemplateValues });
      if (!allowedTemplates.has(row.template.toLowerCase())) errors.push({ type: "invalid-template", line: row.line, slug: row.slug, value: row.template });
    }
    const slug = row.slug.toLowerCase();
    if (!slugLines.has(slug)) slugLines.set(slug, []);
    slugLines.get(slug).push(row.line);
  }
  for (const [slug, lines] of slugLines) if (lines.length > 1) errors.push({ type: "duplicate-slug", slug, lines });
  for(const [keyword,lines] of keywordLines)if(lines.length>1)errors.push({type:'duplicate-keyword',keyword,lines});
  for(const [region,types] of regionTypes)if(types.length!==TYPES.length||TYPES.some(type=>types.filter(t=>t===type).length!==1))errors.push({type:'region-combinations',region,templates:types});

  const oldPublished = baseline.rows.filter((row) => row.status.toLowerCase() === "publish");
  const oldBySlug = new Map(oldPublished.map((row) => [row.slug.toLowerCase(), row]));
  const added = published.filter((row) => !oldBySlug.has(row.slug.toLowerCase()));
  const removed = oldPublished.filter((row) => !slugLines.has(row.slug.toLowerCase()));
  const identityConflicts = published
    .filter((row) => oldBySlug.has(row.slug.toLowerCase()) && identity(row) !== identity(oldBySlug.get(row.slug.toLowerCase())))
    .map((row) => ({ slug: row.slug, old: identity(oldBySlug.get(row.slug.toLowerCase())), current: identity(row) }));
  if (identityConflicts.length) errors.push({ type: "existing-slug-identity-conflict", count: identityConflicts.length, samples: identityConflicts.slice(0, 20) });

  const oldRegions = new Set(oldPublished.map((row) => `${row.province}|${row.region}`));
  const addedRegions = [...new Set(added.map((row) => `${row.province}|${row.region}`))]
    .filter((region) => !oldRegions.has(region))
    .sort((a, b) => a.localeCompare(b, "ko"));
  const addedCounties = addedRegions.filter((region) => region.split("|")[1].endsWith("\uAD70"));
  if (removed.length) warnings.push({ type: "removed-pages", count: removed.length, samples: removed.slice(0, 20).map((row) => row.slug) });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    counts: {
      baselinePublished: oldPublished.length,
      currentPublished: published.length,
      addedPages: added.length,
      removedPages: removed.length,
      addedRegions: addedRegions.length,
      addedCounties: addedCounties.length,
    },
    addedRegions,
    addedCounties,
    addedSlugSamples: added.slice(0, 20).map((row) => row.slug),
  };
}

function main() {
  const baselinePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultBaselinePath;
  if (!fs.existsSync(currentPath)) throw new Error(`Current CSV not found: ${currentPath}`);
  const current = loadCsv(currentPath);
  const baselineExists = fs.existsSync(baselinePath);
  const report = validate(current, baselineExists ? loadCsv(baselinePath) : current);
  report.baseline = baselineExists ? path.relative(root, baselinePath) : null;
  if (!baselineExists) report.warnings.push({ type: "baseline-not-found", path: baselinePath });
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { loadCsv, validate };
