# Gemini Proxy Worker

A Cloudflare Worker that proxies requests to Google's Gemini API, providing an OpenAI-compatible interface.

## Features

- ✅ OpenAI-compatible API interface
- ✅ Support for chat completions endpoint
- ✅ Support for embeddings endpoint
- ✅ Support for models endpoint
- ✅ Streaming responses support
- ✅ Function calling support
- ✅ Image input support
- ✅ CORS support

## Endpoints

- `POST /chat/completions` - Chat completions (OpenAI-compatible)
- `POST /embeddings` - Embeddings generation
- `GET /models` - List available models

## Deployment

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account

### Local Development

```bash
npm install
npm run dev
```

### Deploy to Cloudflare

```bash
npm run deploy
```

## Usage

### Set API Key

You can set your Google API key in two ways:

1. **Via Environment Variable** (Recommended):

   ```bash
   wrangler secret put API_KEY
   ```

2. **Via Authorization Header**:
   ```bash
   curl -X POST https://your-worker.your-account.workers.dev/chat/completions \
     -H "Authorization: Bearer YOUR_GOOGLE_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "gemini-pro", "messages": [{"role": "user", "content": "Hello!"}]}'
   ```

## API Examples

### Chat Completions

```bash
curl -X POST https://your-worker/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-pro",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Streaming Response

```bash
curl -X POST https://your-worker/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-pro",
    "messages": [
      {"role": "user", "content": "Count to 100"}
    ],
    "stream": true
  }'
```

### Embeddings

```bash
curl -X POST https://your-worker/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-004",
    "input": "Hello world"
  }'
```

## Supported Models

- `gemini-pro` (default for chat)
- `gemini-pro-vision` (for image input)
- `text-embedding-004` (for embeddings)

## Configuration

You can configure the worker using environment variables:

- `API_KEY` - Your Google API key (can be set via `wrangler secret put API_KEY`)

## License

MIT
