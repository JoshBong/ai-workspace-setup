export function architecture({ projectName, description, techStack, date }) {
  return `# ${projectName} — Architecture Overview

> **Last updated:** ${date}

## What This Is

${description}

## Tech Stack

${techStack}

## How the Repos Connect

<!-- Describe how your repos talk to each other. Examples: -->
<!-- - Frontend calls backend API at /api/* -->
<!-- - Backend reads/writes to the database -->
<!-- - Shared types between repos -->

(Fill this in as you build.)

## Key Data Structures

<!-- List the most important models/schemas/types in your project. -->
<!-- These are the ones where a change ripples through multiple files. -->

(Fill this in as you build.)

## Known Gaps

<!-- Things that are stored but not used, missing features, tech debt. -->

(Fill this in as you discover them.)
`;
}

export function apiContracts({ date }) {
  return `# API Contracts

> **Last updated:** ${date}
> If code and docs disagree, update the code. This file is the final authority.

## Endpoints

<!-- Document your API endpoints here. Example: -->
<!--
### POST /api/users
Creates a new user.
Request: { "email": "string", "name": "string" }
Response: { "id": "string", "email": "string", "name": "string" }
Errors: 400 (validation), 409 (duplicate email)
-->

(Add endpoints as you build them.)
`;
}

export function decisions({ date, author }) {
  return `# Decisions Log

> Reverse-chronological log of non-obvious decisions, rejected approaches, and dead ends.
> When you reject an approach or make a choice that isn't self-evident from the code, add an entry.
> Format: ## YYYY-MM-DD — Title (by [name]) followed by two sentences.
> Agents read this before suggesting alternatives you've already ruled out.

---

## ${date} — Workspace setup (by ${author})

Set up AI-augmented workspace with Obsidian vault as shared brain, CLAUDE.md for session context, and .ai-rules per repo. Vault is the single source of truth — agents read it before writing code.
`;
}

export function sessionLog() {
  return `# Session Log

> Two-line handoff notes at the end of each session.
> Helps the next session pick up where the last one left off.
> Format: ## YYYY-MM-DD — Session summary (by [name])
> Line 1: What was done. Line 2: Where things left off / what's next.

(No sessions logged yet.)
`;
}
