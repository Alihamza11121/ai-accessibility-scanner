# AI Accessibility Scanner

A local web application that scans a website with Playwright and axe-core, captures screenshots for affected elements, and provides remediation suggestions. If Ollama is running locally, suggestions use the selected local model; otherwise, the app uses built-in rule-based guidance.

## Requirements

- Node.js (LTS recommended)
- Internet access for installing npm packages and opening the website you want to scan
- Optional: Ollama and a model such as `llama3`

## Install once

Open PowerShell in this project folder and run:

```powershell
npm install
npx playwright install chromium
Copy-Item .env.example .env
cd frontend
npm install
cd ..
```

If `Copy-Item` says the `.env` file already exists, keep your existing file.

## Run the application

**Terminal 1 — backend:** in the project root:

```powershell
npm start
```

The API runs at `http://localhost:3000`.

**Terminal 2 — frontend:** open a second PowerShell window, go to this project's `frontend` folder, and run:

```powershell
npm start
```

The React app opens at `http://localhost:3001` if port 3000 is already in use by the backend. If React asks to use another port, answer `Y`.

## Optional local AI

Install/start Ollama, then pull a model:

```powershell
ollama pull llama3
```

The default settings are in `.env`. Ollama is optional: the scanner still works with built-in remediation guidance if Ollama is unavailable. If Ollama is slow, reduce `AI_TIMEOUT_MS` in `.env`.

## How to use

1. Open the frontend.
2. Enter a website URL such as `https://example.com`.
3. Select **Scan website**.
4. Review the custom indicator, severity summary, screenshots, selectors, WCAG tags, and suggestions.
5. Select **Download PDF report** to export findings.

## Notes

- The custom 0–100 indicator is a project-specific heuristic, **not** an official WCAG score.
- Findings are affected elements; a single axe rule can affect multiple elements.
- Automated checks do not prove WCAG conformance. Manually test keyboard use, focus order, zoom/reflow, and screen-reader behavior.
- Scan only websites you own or are authorized to test.
- Screenshots are stored under `src/screenshots` and served locally by the backend.


## Policy selector and scope

The frontend lets you select WCAG 2.1 Level AA, WCAG 2.2 Level AA, or an ADA-oriented review using selected automated WCAG 2.1 A/AA checks. The selected policy is included in results and the PDF. The ADA option is not a separate ADA rules engine or legal certification. WCAG 2.2 selection adds the axe-core `wcag22aa` tag but does not test every success criterion. Automated checks cannot prove complete WCAG or ADA compliance.
