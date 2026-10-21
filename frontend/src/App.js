import React, { useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:3000";

function ImagePanel({ src, alt }) {
  if (!src) return <div className="no-image">Screenshot unavailable for this element.</div>;
  return <a href={`${API}${src}`} target="_blank" rel="noreferrer"><img className="issue-image" src={`${API}${src}`} alt={alt} /></a>;
}

function Advice({ advice }) {
  if (!advice) return <p>No suggestion was returned.</p>;
  if (typeof advice === "string") return <p>{advice}</p>;
  return <div className="advice">
    <div className="ai-label">{advice.aiStatus || "Suggested remediation"}</div>
    {advice.problem && <p><strong>Problem:</strong> {advice.problem}</p>}
    {advice.why && <p><strong>Why it matters:</strong> {advice.why}</p>}
    {advice.fix && <p><strong>Suggested fix:</strong> {advice.fix}</p>}
    {advice.codeExample && <><strong>Example:</strong><pre>{advice.codeExample}</pre></>}
    {advice.bestPractice && <p><strong>Best practice:</strong> {advice.bestPractice}</p>}
  </div>;
}

export default function App() {
  const [url, setUrl] = useState("https://example.com");
  const [policy, setPolicy] = useState("wcag21aa");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [showFull, setShowFull] = useState(false);

  const issues = useMemo(() => {
    const all = Array.isArray(report?.violations) ? report.violations : [];
    return filter === "all" ? all : all.filter(item => item.severity === filter);
  }, [report, filter]);

  async function runScan(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const response = await axios.get(`${API}/scan`, { params: { url: url.trim(), policy }, timeout: 240000 });
      if (!response.data?.success || !response.data?.report) throw new Error(response.data?.error || "The scan did not return a report.");
      setReport(response.data.report);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Unable to scan. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    try {
      const response = await axios.post(`${API}/report/pdf`, { report }, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "accessibility-report.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError("Could not create the PDF report. " + (err.message || ""));
    }
  }

  return <div className="app-shell">
    <header className="hero">
      <div className="brand-mark">A11Y</div>
      <div>
        <p className="eyebrow">QUALITY · ACCESSIBILITY · AI</p>
        <h1>AI Accessibility Scanner</h1>
        <p className="hero-copy">Find accessibility issues, see exactly where they appear, and get practical remediation suggestions.</p>
      </div>
    </header>

    <main className="main-content">
      <section className="scan-panel">
        <form onSubmit={runScan}>
          <label htmlFor="testing-policy">Accessibility standard / policy</label>
          <select id="testing-policy" className="policy-select" value={policy} onChange={e => setPolicy(e.target.value)}>
            <option value="wcag21aa">WCAG 2.1 Level AA</option>
            <option value="wcag22aa">WCAG 2.2 Level AA</option>
            <option value="ada">ADA-oriented review (automated WCAG 2.1 AA checks)</option>
          </select>
          <p className="hint policy-hint">Choose a target before scanning. The report identifies the selected target and its scope.</p>
          <label htmlFor="website-url">Website URL</label>
          <div className="scan-row">
            <input id="website-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" required />
            <button type="submit" disabled={loading}>{loading ? "Scanning…" : "Scan website"}</button>
          </div>
          <p className="hint">Scan only websites you own or are authorized to test. A scan can take a few minutes.</p>
        </form>
        {loading && <div className="loading"><span className="spinner" /> Running browser checks and generating suggestions. Keep this page open.</div>}
        {error && <div className="error-box" role="alert">{error}</div>}
      </section>

      {report && <>
        <section className="report-heading">
          <div><p className="eyebrow">SCAN COMPLETE</p><h2>Results overview</h2><p className="muted break-word">{report.url}</p><p className="policy-result"><strong>Selected policy:</strong> {report.policy?.label || "Not specified"}</p><p className="muted">{report.policy?.note}</p></div>
          <button className="secondary-button" onClick={downloadPdf}>Download PDF report</button>
        </section>
        <section className="summary-grid">
          <div className="metric score-metric"><span>Custom indicator</span><strong>{report.score}<small>/100</small></strong><p>Not an official WCAG score</p></div>
          <div className="metric"><span>Affected elements</span><strong>{report.totalViolations ?? 0}</strong><p>{report.ruleCount ?? 0} axe rule categories</p></div>
          {["critical", "serious", "moderate", "minor"].map(level => <div className={`metric severity-metric ${level}`} key={level}><span>{level}</span><strong>{report.summary?.[level] ?? 0}</strong><p>affected elements</p></div>)}
        </section>

        <section className="page-shot">
          <button className="section-toggle" onClick={() => setShowFull(v => !v)}>{showFull ? "− Hide full-page screenshot" : "+ Show full-page screenshot"}</button>
          {showFull && <ImagePanel src={report.screenshot} alt="Full-page screenshot of scanned website" />}
        </section>

        <section className="findings-heading">
          <div><h2>Accessibility findings</h2><p className="muted">Each card represents an affected element. Screenshots are best-effort and may not be available for every selector.</p></div>
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter by severity">
            <option value="all">All severities</option><option value="critical">Critical</option><option value="serious">Serious</option><option value="moderate">Moderate</option><option value="minor">Minor</option>
          </select>
        </section>

        {issues.length === 0 ? <div className="empty-state">No findings match this filter. Automated scans cannot prove full WCAG conformance.</div> :
          <div className="findings-list">{issues.map((item, index) => <article className="issue-card" key={`${item.rule}-${item.number}-${index}`}>
            <div className="issue-top">
              <div><span className={`severity-pill ${item.severity}`}>{item.severity || "unknown"}</span><span className="issue-number">Issue #{item.number}</span></div>
              <h3>{item.rule}</h3>
              <p>{item.description}</p>
            </div>
            <div className="screenshots-grid">
              <div><h4>Highlighted location</h4><p className="muted small">Red outline identifies the affected element.</p><ImagePanel src={item.highlightedScreenshot} alt={`Highlighted location for issue ${item.number}`} /></div>
              <div><h4>Element close-up</h4><p className="muted small">Closer view of the affected element.</p><ImagePanel src={item.elementScreenshot} alt={`Element close-up for issue ${item.number}`} /></div>
            </div>
            <div className="details-grid">
              <div><h4>Selector</h4><code className="selector">{item.selector || "Not available"}</code></div>
              <div><h4>WCAG / tags</h4><div className="tags">{(item.tags || []).map(tag => <span key={tag}>{tag}</span>)}</div></div>
            </div>
            {item.failureSummary && <details className="technical-details"><summary>axe-core failure details</summary><pre>{item.failureSummary}</pre></details>}
            {item.html && <details className="technical-details"><summary>Affected HTML</summary><pre>{item.html}</pre></details>}
            {item.helpUrl && <p className="help-link"><a href={item.helpUrl} target="_blank" rel="noreferrer">Read axe-core guidance ↗</a></p>}
            <div className="suggestion-box"><h4>Suggested remediation</h4><Advice advice={item.advice} /></div>
          </article>)}</div>
        }
        <p className="disclaimer">This tool combines automated axe-core checks with optional local Ollama suggestions. Findings require human review; automated testing alone does not establish legal compliance.</p>
      </>}
    </main>
    <footer>AI Accessibility Scanner · Playwright + axe-core · Optional Ollama AI</footer>
    <footer className="site-footer">
  <p>
    Idea and Development by <strong>Ali Hamza Kazmi</strong>
    <span className="footer-separator"> | </span>
    Senior Test Consultant
  </p>
</footer>
  </div>;

  
}