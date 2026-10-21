const axios = require("axios");

const fallbackAdvice = (violation) => {
  const rule = String(violation.rule || "").toLowerCase();
  const text = `${violation.description || ""} ${violation.html || ""}`.toLowerCase();

  if (rule.includes("image-alt") || text.includes("<img")) {
    return {
      problem: "An image may not have an accessible text alternative.",
      why: "Screen-reader users may not understand the information conveyed by the image.",
      fix: "Add meaningful alt text to informative images. Use alt=\"\" for purely decorative images.",
      codeExample: '<img src=\"team.jpg\" alt=\"Support team meeting in an office\">',
      bestPractice: "Describe the image's purpose, not every visual detail.",
      aiStatus: "Rule-based fallback"
    };
  }
  if (rule.includes("label") || rule.includes("input")) {
    return {
      problem: "A form control may not have a programmatic label.",
      why: "Assistive technologies need a name to explain the control's purpose.",
      fix: "Associate a visible label with the input using matching for/id attributes, or provide an appropriate accessible name.",
      codeExample: '<label for=\"email\">Email address</label>\\n<input id=\"email\" name=\"email\" type=\"email\">',
      bestPractice: "Prefer visible labels; placeholders are not a replacement for labels.",
      aiStatus: "Rule-based fallback"
    };
  }
  if (rule.includes("button-name") || rule.includes("link-name")) {
    return {
      problem: "A button or link may not have an accessible name.",
      why: "Screen-reader users need to know what the control does or where the link goes.",
      fix: "Add meaningful text or an accessible name. Icon-only controls should have an aria-label.",
      codeExample: '<button type=\"button\" aria-label=\"Close dialog\">×</button>',
      bestPractice: "Use concise names that describe the action or destination.",
      aiStatus: "Rule-based fallback"
    };
  }
  if (rule.includes("contrast")) {
    return {
      problem: "Text may not have sufficient contrast against its background.",
      why: "Low contrast can make text difficult to read for people with low vision or color-vision deficiencies.",
      fix: "Adjust foreground and background colors to meet WCAG contrast requirements (usually 4.5:1 for normal text and 3:1 for large text).",
      codeExample: "/* Example only: verify colors with a contrast checker */\\n.text { color: #1f2937; background: #ffffff; }",
      bestPractice: "Do not use color alone to communicate meaning.",
      aiStatus: "Rule-based fallback"
    };
  }
  if (rule.includes("landmark") || rule.includes("main")) {
    return {
      problem: "The page structure may be missing a useful landmark.",
      why: "Landmarks help assistive-technology users navigate major page sections.",
      fix: "Use semantic HTML landmarks such as header, nav, main, and footer, with one main landmark for the primary content.",
      codeExample: "<header>...</header>\\n<nav aria-label=\"Main navigation\">...</nav>\\n<main>...</main>\\n<footer>...</footer>",
      bestPractice: "Prefer native semantic HTML over adding ARIA roles unnecessarily.",
      aiStatus: "Rule-based fallback"
    };
  }
  return {
    problem: violation.description || "An accessibility issue was detected.",
    why: "This issue may make some page content or functionality harder to use with assistive technology.",
    fix: violation.help || "Review the affected HTML and apply the rule's guidance.",
    codeExample: "Inspect the affected element and use semantic HTML and accessible names where appropriate.",
    bestPractice: "Retest the change with keyboard navigation and assistive technology, as well as automated checks.",
    aiStatus: "Rule-based fallback"
  };
};

async function analyzeIssue(violation) {
  const fallback = fallbackAdvice(violation);
  const base = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3";
  const timeout = Math.max(1000, Number(process.env.AI_TIMEOUT_MS || 5000));

  try {
    const response = await axios.post(
      `${base}/api/generate`,
      {
        model,
        stream: false,
        format: "json",
        prompt: [
          "You are a practical web accessibility specialist.",
          "Return valid JSON only with keys: problem, why, fix, codeExample, bestPractice.",
          "Keep each value concise. Do not claim certainty beyond the provided evidence.",
          `Rule: ${violation.rule}`,
          `Description: ${violation.description}`,
          `Help: ${violation.help}`,
          `HTML: ${String(violation.html || "").slice(0, 1500)}`,
          `Selector: ${violation.selector || ""}`
        ].join("\n")
      },
      { timeout }
    );
    const parsed = JSON.parse(response.data.response);
    return {
      problem: parsed.problem || fallback.problem,
      why: parsed.why || fallback.why,
      fix: parsed.fix || fallback.fix,
      codeExample: parsed.codeExample || fallback.codeExample,
      bestPractice: parsed.bestPractice || fallback.bestPractice,
      aiStatus: "Ollama AI"
    };
  } catch (_) {
    return fallback;
  }
}

module.exports = { analyzeIssue };