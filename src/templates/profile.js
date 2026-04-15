export function workingStyle() {
  return `# Working Style

> How you prefer to work with AI agents. This file is empty on purpose —
> it fills in over time as agents learn your patterns.
> When an agent notices a preference, it will ask to log it here.

(No entries yet. Your agents will learn as you work together.)
`;
}

export function preferences() {
  return `# Preferences

> Code taste, commit style, response format, autonomy level.
> Starts empty — agents will ask to add entries when they notice patterns
> or when you correct their behavior.

(No entries yet. Your agents will learn as you work together.)
`;
}

export function corrections() {
  return `# Corrections Log

> Reverse-chronological log of behavioral corrections.
> When you tell an agent "don't do that" or "actually I want it this way,"
> it logs the correction here and updates the relevant profile file.
> Format: ## YYYY-MM-DD — Short description

(No entries yet.)
`;
}
