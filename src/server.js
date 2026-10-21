require("dotenv").config();
const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const { scanWebsite } = require("./scanner/accessibilityScanner");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/screenshots", express.static(require("path").join(__dirname, "screenshots")));

app.get("/", (_req, res) => res.send("AI Accessibility Scanner API is running. Open the React frontend to scan a website."));
app.get("/health", (_req, res) => res.json({ ok: true, service: "AI Accessibility Scanner API" }));

app.get("/scan", async (req, res) => {
  let url = String(req.query.url || "").trim();
  const policy = String(req.query.policy || "wcag21aa").trim().toLowerCase();
  if (!["wcag21aa", "wcag22aa", "ada"].includes(policy)) return res.status(400).json({ success: false, error: "Unsupported testing policy." });
  if (!url) return res.status(400).json({ success: false, error: "Please provide a website URL using ?url=https://example.com" });
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
    const report = await scanWebsite(parsed.toString(), policy);
    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      project: "AI Accessibility Scanner",
      version: "1.0.0",
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || "Scan failed. Check the URL and try again." });
  }
});

app.post("/report/pdf", (req, res) => {
  const report = req.body && req.body.report;
  if (!report || !Array.isArray(report.violations)) return res.status(400).json({ error: "A valid report is required." });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="accessibility-report.pdf"');
  const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
  doc.pipe(res);
  doc.fontSize(20).text("Website Accessibility Report");
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#555").text(`Generated: ${new Date().toLocaleString()}`);
  doc.fillColor("#000").moveDown();
  doc.fontSize(12).text(`Website: ${report.url || "Unknown"}`);
  doc.text(`Selected testing policy: ${report.policy?.label || "Not specified"}`);
  if (report.policy?.note) doc.fontSize(9).fillColor("#555").text(`Scope note: ${report.policy.note}`).fillColor("#000");
  doc.text(`Custom indicator: ${report.score ?? "N/A"}/100`);
  doc.text(`Affected elements: ${report.totalViolations ?? report.violations.length}`);
  doc.moveDown();
  doc.fontSize(14).text("Severity summary");
  const summary = report.summary || {};
  ["critical", "serious", "moderate", "minor"].forEach(level => doc.fontSize(10).text(`${level}: ${summary[level] || 0}`));
  doc.moveDown();
  doc.fontSize(14).text("Findings");
  report.violations.forEach((item, index) => {
    if (doc.y > 690) doc.addPage();
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#000").text(`${index + 1}. ${item.rule || "Accessibility issue"} (${item.severity || "unknown"})`);
    doc.fontSize(9).text(item.description || "");
    doc.text(`Selector: ${item.selector || "Not available"}`);
    if (item.tags && item.tags.length) doc.text(`WCAG / tags: ${item.tags.join(", ")}`);
    if (item.helpUrl) doc.text(`Guidance: ${item.helpUrl}`);
    const advice = item.advice || {};
    if (advice.problem) doc.text(`Problem: ${advice.problem}`);
    if (advice.why) doc.text(`Why it matters: ${advice.why}`);
    if (advice.fix) doc.text(`Suggested fix: ${advice.fix}`);
    if (advice.codeExample) doc.text(`Example: ${advice.codeExample}`);
  });
  doc.end();
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Accessibility Scanner API running at http://localhost:${port}`));