# Project Guidelines for LLM Agents (Google Apps Script + Clasp)

## Overview
This project is a **Google Apps Script (GAS)** application/automation managed locally using **Google Clasp** and stored in a GitHub repository. 

## Tech Stack & Environment
- **Language:** JavaScript (ES6+) or TypeScript (depending on configuration)
- **Runtime:** Google Apps Script V8 Engine
- **Deployment Tool:** Google Clasp (`@google/clasp`)
- **Key Google Services:** Google Sheets, Google Drive, Gmail, etc. (adjust based on project needs)

## Project Structure
```text
/
├── src/                 # Source code files (.js / .ts)
├── appsscript.json      # GAS Manifest file (scopes, timezones, runtime version)
├── .clasp.json          # Clasp project configuration (Script ID mapping)
└── AGENTS.md            # LLM Instructions (this file)
```

## Development & Workflow Rules

1. Local Development: Code is written locally and pushed to Google Apps Script.
2. GAS Limitations & Quotas:
- Execution time limit is typically 6 minutes per run.
- Be aware of Google API quotas (Fetch URL limits, email quotas, etc.).
3. Best Practices:
- Write modular, clean, and well-commented code using `JSDoc` where applicable.
- Handle errors gracefully using try-catch and proper logging (`console.log` / `Logger.log`).
- Respect proper naming conventions for GAS triggers (`onEdit`, `onOpen`, etc.) if used.

## Instructions for LLM when writing code:
- Do not use browser-specific DOM APIs (like document, window), as GAS runs on V8 servers, not in a browser.
- Use native GAS services like `SpreadsheetApp`, `DriveApp`, `GmailApp`, `PropertiesService`, etc.
- Keep security in mind: do not hardcode sensitive tokens or passwords; use `PropertiesService` for storing secrets.

## Working with Git

- Never do `git commit` or `git push`. These can be done only by me. You're usage of git is read-only
- After finishing implementing something suggest a good and clean git commit message.

