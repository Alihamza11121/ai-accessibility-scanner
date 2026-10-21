const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const path = require("path");
const fs = require("fs");
const { analyzeIssue } = require("./aiAnalyzer");

const screenshotDir = path.join(__dirname, "..", "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

function calculateScore(issues) {
  const weights = {
    critical: 10,
    serious: 5,
    moderate: 2,
    minor: 1
  };

  const penalty = issues.reduce(
    (sum, issue) => sum + (weights[issue.severity] || 1),
    0
  );

  return Math.max(0, Math.min(100, 100 - penalty));
}

function safeName(value) {
  return (
    String(value).replace(/[^a-z0-9_-]/gi, "_").slice(0, 55) || "page"
  );
}

const POLICY_OPTIONS = {
  wcag21aa: {
    label: "WCAG 2.1 Level AA",
    tags: [
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "best-practice"
    ],
    note:
      "Selected axe-core rules tagged to WCAG 2.0/2.1 A and AA plus best-practice rules. Not a complete conformance evaluation."
  },

  wcag22aa: {
    label: "WCAG 2.2 Level AA",
    tags: [
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22aa",
      "best-practice"
    ],
    note:
      "Selected axe-core rules tagged to WCAG 2.0/2.1 A and AA, WCAG 2.2 AA, and best-practice rules. Not every success criterion is automatically tested."
  },

  ada: {
    label: "ADA-oriented review (automated WCAG 2.1 AA checks)",
    tags: [
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "best-practice"
    ],
    note:
      "An automated WCAG 2.1 A/AA-oriented review that may support accessibility work related to the ADA. It is not legal advice or ADA certification."
  }
};

async function scanWebsite(url, selectedPolicy = "wcag21aa") {
  const policyKey = POLICY_OPTIONS[selectedPolicy]
    ? selectedPolicy
    : "wcag21aa";

  const policy = POLICY_OPTIONS[policyKey];

  let browser;
  let context;

  const started = Date.now();

  try {
    // Launch Chromium.
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    // Create an explicit browser context.
    context = await browser.newContext({
      viewport: {
        width: 1440,
        height: 900
      },
      deviceScaleFactor: 1
    });

    // Create the page from the context.
    const page = await context.newPage();

    page.setDefaultTimeout(8000);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(700);

    // Run axe-core with the selected policy tags.
    const axeResults = await new AxeBuilder({ page })
      .withTags(policy.tags)
      .analyze();

    const stamp = `${Date.now()}_${safeName(new URL(url).hostname)}`;

    const fullScreenshotName = `${stamp}_full.png`;
    const fullScreenshotPath = path.join(
      screenshotDir,
      fullScreenshotName
    );

    await page
      .screenshot({
        path: fullScreenshotPath,
        fullPage: true,
        animations: "disabled"
      })
      .catch(() => {});

    // Convert axe-core violations into individual affected-element issues.
    const rawIssues = [];

    for (const violation of axeResults.violations) {
      for (const node of violation.nodes) {
        rawIssues.push({
          rule: violation.id,
          severity: violation.impact || "moderate",
          description: violation.description || violation.help,
          help: violation.help,
          helpUrl: violation.helpUrl,
          tags: violation.tags || [],
          html: node.html || "",
          selector: Array.isArray(node.target)
            ? node.target.join(", ")
            : String(node.target || ""),
          failureSummary: node.failureSummary || ""
        });
      }
    }

    const issues = [];

    for (let i = 0; i < rawIssues.length; i++) {
      const issue = rawIssues[i];
      const number = i + 1;
      const safeSelector = issue.selector;

      const highlightedName =
        `${stamp}_issue_${number}_highlight.png`;

      const elementName =
        `${stamp}_issue_${number}_element.png`;

      let box = null;

      try {
        // Use the first selector for the screenshot target.
        const firstSelector = safeSelector.split(",")[0].trim();
        const locator = page.locator(firstSelector).first();

        await locator.scrollIntoViewIfNeeded({
          timeout: 2500
        });

        box = await locator.boundingBox({
          timeout: 2500
        });

        if (box) {
          // Highlight the affected element and add an issue label.
          await page.evaluate(
            ({ selector, number, severity }) => {
              document
                .querySelectorAll("[data-a11y-scanner-overlay]")
                .forEach(element => element.remove());

              document
                .querySelectorAll("[data-a11y-scanner-target]")
                .forEach(element => {
                  element.removeAttribute(
                    "data-a11y-scanner-target"
                  );
                });

              let target;

              try {
                target = document.querySelector(selector);
              } catch (_) {
                return;
              }

              if (!target) return;

              target.setAttribute(
                "data-a11y-scanner-target",
                "true"
              );

              target.style.setProperty(
                "outline",
                "4px solid #e11d48",
                "important"
              );

              target.style.setProperty(
                "outline-offset",
                "3px",
                "important"
              );

              const badge = document.createElement("div");

              badge.setAttribute(
                "data-a11y-scanner-overlay",
                "true"
              );

              badge.textContent =
                `Issue #${number} · ${severity.toUpperCase()}`;

              Object.assign(badge.style, {
                position: "absolute",
                zIndex: "2147483647",
                background: "#e11d48",
                color: "#ffffff",
                font: "bold 13px Arial, sans-serif",
                padding: "7px 10px",
                borderRadius: "5px",
                boxShadow: "0 2px 8px rgba(0,0,0,.35)",
                pointerEvents: "none",
                left: `${Math.max(
                  4,
                  window.scrollX +
                    target.getBoundingClientRect().left
                )}px`,
                top: `${Math.max(
                  4,
                  window.scrollY +
                    target.getBoundingClientRect().top -
                    32
                )}px`
              });

              document.body.appendChild(badge);
            },
            {
              selector: firstSelector,
              number,
              severity: issue.severity
            }
          );

          await page
            .screenshot({
              path: path.join(
                screenshotDir,
                highlightedName
              ),
              fullPage: false,
              animations: "disabled"
            })
            .catch(() => {});

          await locator
            .screenshot({
              path: path.join(screenshotDir, elementName),
              animations: "disabled",
              timeout: 2500
            })
            .catch(() => {});

          // Remove our highlighting before processing the next issue.
          await page
            .evaluate(() => {
              document
                .querySelectorAll("[data-a11y-scanner-overlay]")
                .forEach(element => element.remove());

              document
                .querySelectorAll("[data-a11y-scanner-target]")
                .forEach(element => {
                  element.removeAttribute(
                    "data-a11y-scanner-target"
                  );

                  element.style.removeProperty("outline");
                  element.style.removeProperty("outline-offset");
                });
            })
            .catch(() => {});
        }
      } catch (error) {
        // Keep the issue in the report if its screenshot cannot be captured.
        console.warn(
          `Screenshot failed for issue #${number}:`,
          error.message
        );
      }

      const advice = await analyzeIssue(issue);

      issues.push({
        number,
        ...issue,
        boundingBox: box,
        highlightedScreenshot: box
          ? `/screenshots/${highlightedName}`
          : null,
        elementScreenshot: box
          ? `/screenshots/${elementName}`
          : null,
        advice
      });
    }

    const summary = {
      critical: issues.filter(
        issue => issue.severity === "critical"
      ).length,

      serious: issues.filter(
        issue => issue.severity === "serious"
      ).length,

      moderate: issues.filter(
        issue => issue.severity === "moderate"
      ).length,

      minor: issues.filter(
        issue => issue.severity === "minor"
      ).length
    };

    const score = calculateScore(issues);

    return {
      url,

      policy: {
        id: policyKey,
        label: policy.label,
        note: policy.note,
        axeTags: policy.tags
      },

      score,

      scoreNote:
        "Custom indicator based on detected affected elements and severity; it is not an official WCAG conformance score.",

      screenshot: fs.existsSync(fullScreenshotPath)
        ? `/screenshots/${fullScreenshotName}`
        : null,

      totalViolations: issues.length,
      ruleCount: axeResults.violations.length,
      summary,
      durationMs: Date.now() - started,
      violations: issues
    };
  } finally {
    // Close resources even when navigation or scanning fails.
    if (context) {
      await context.close().catch(() => {});
    }

    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = { scanWebsite };