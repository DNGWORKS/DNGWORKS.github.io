# DNGWORKS V21 — GitHub Upload Ready

Upload/replace these files in repo `DNGWORKS/DNGWORKS.github.io` on branch `main`:

1. `assets/js/dng-support-core.js`
2. `assets/js/dng-ai-widget.js`
3. `assets/css/dng-ai-widget.css`
4. `assets/js/insights-live.js`
5. `scripts/update_news.py`

## What changes
- Keeps only one visible DNG AI entry point (legacy Insights AI button is removed at runtime).
- Removes the browser-side 3 AI calls/day quota.
- Sends multi-turn chat history/session id to the existing Worker.
- Improves chat UI (textarea, Enter send, Shift+Enter newline, session history, New chat, sources).
- Adds “Analyze with DNG AI” from insight reader.
- Expands the news crawler and adds Technology + Science/Future data groups.
- Embeds YouTube/direct MP4 in Insights when a playable source URL is available.

## Important
This package does NOT modify the Cloudflare Worker backend. The website-side daily cap is removed, but ChatGPT-like quality, streaming, persistent server memory and web-search capability require a separate Worker upgrade.

## After upload
Wait for GitHub Pages to deploy and for the News Update workflow to run, or manually run the workflow `News Update Every 6 Hours` once so `data/news.json` gains the larger/new sections immediately.
