# ContextLayer

ContextLayer is a Chrome extension that understands the current page, answers grounded questions about it, and executes reversible visual actions such as highlighting and scrolling to relevant content.

## Ownership

| Area | Owner | Directories |
|---|---|---|
| Architecture, contracts, AI reasoning, LLM and backend | Developer 1 | `packages/shared`, `apps/api` |
| Semantic DOM extraction and reversible actions | Developer 2 | `packages/page-engine` |
| Chrome extension, chat UI, playground and integration | Developer 3 | `apps/extension`, `apps/playground` |

See [team ownership](docs/team-ownership.md) before changing code outside an owned directory.

## Intended dependency direction

```text
packages/shared
      ↑
      ├──────── apps/api
      └──────── packages/page-engine
                      ↑
                      ├──────── apps/extension
                      └──────── apps/playground
```

Rules:

- `packages/shared` contains serializable contracts only and must not import application code.
- `apps/api` must not import DOM or Chrome APIs.
- `packages/page-engine` must not call an LLM or render product UI.
- `apps/extension` and `apps/playground` integrate the other packages; they must not create alternative AI or DOM engines.
- Contract changes require agreement from all three owners.

## Current state

The repository contains the working API, semantic page engine, Manifest V3 extension, and automated integration tests. The public playground workspace is reserved for future development and is not implemented. The extension includes persistent local chat history and user settings for theme, accent color, text and launcher sizes, launcher position, response style, answer length, emoji usage, keyboard behavior, and custom instructions.

Chat history and settings are stored in `chrome.storage.local`. API keys remain server-side and are never stored in the extension.

## Complete local setup

### Requirements

- Desktop Google Chrome or another Chromium browser with unpacked-extension support;
- Git;
- Node.js 22.12 or newer with npm;
- internet access;
- an OpenAI API key with available API billing or credits.

Mobile browsers are not supported.

### 1. Clone and install

```bash
git clone https://github.com/afarajov/AmAmAm.git
cd AmAmAm
npm ci
```

### 2. Create the backend environment file

On macOS or Linux:

```bash
cp apps/api/.env.example apps/api/.env
```

On Windows PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and set at least:

```dotenv
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
HOST=127.0.0.1
PORT=8787
```

Never commit or share `apps/api/.env`. The API key belongs only in the backend.

### 3. Build and install the extension

```bash
npm run release --workspace @contextlayer/extension
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `apps/extension/release/contextlayer-extension`.
5. Copy the extension ID displayed by Chrome.

Add that exact ID to `apps/api/.env`:

```dotenv
CORS_ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
```

### 4. Start and verify the backend

```bash
npm run dev --workspace @contextlayer/api
```

Open these URLs and confirm that both services report success:

- `http://127.0.0.1:8787/health`
- `http://127.0.0.1:8787/ready`

Open or refresh a normal HTTP(S) webpage, click the ContextLayer toolbar icon,
and confirm that the panel displays **API mode**. After rebuilding, select
**Reload** for ContextLayer on `chrome://extensions` and refresh the webpage.

### 5. Validate the repository

```bash
npm run check
npm run test:e2e --workspace @contextlayer/extension
```

## Known runtime limitations

- ContextLayer does not run on `chrome://` pages, the Chrome Web Store, or other protected browser pages.
- The local backend must remain running while the extension is used.
- OpenAI API usage may incur charges.
- Image-only, canvas, video, closed Shadow DOM, cross-origin iframe, and non-rendered virtualized content may not be readable.
- The prototype has no public hosted backend or public playground deployment.

## Start here

1. Read [architecture](docs/architecture.md).
2. Read [integration contracts](docs/integration-contracts.md).
3. Confirm ownership in [team ownership](docs/team-ownership.md).
4. Each developer works only in their owned directories.
5. Integrate the first vertical slice as soon as the three adapters exist.

The first shared milestone is:

```text
user query
→ PageSnapshot
→ POST /api/agent/query
→ validated AgentResponse
→ DOM execution result
→ UI confirmation
```
