# Browser security

The OpenAI SDK will refuse to run in a browser unless you pass
`dangerouslyAllowBrowser: true`. This is intentional — shipping your OpenAI
API key in a client bundle exposes it to anyone who opens devtools.

## When it's OK

- Local development.
- Internal-only tools behind authentication.
- Demos and prototypes.

## When it's NOT OK

- Public-facing apps.
- Any environment where untrusted users can inspect the bundle.

## What to do instead

Proxy requests through your own backend:

1. Backend endpoint that accepts `{ messages, tools }` from the client.
2. Backend injects `OPENAI_API_KEY` from environment and calls OpenAI.
3. Backend returns the response to the client.
4. Client implements `LlmProvider` to call your backend instead of OpenAI directly.

```ts
const proxyProvider: LlmProvider = {
  async chat({ messages, tools }) {
    const res = await fetch("/api/llm", {
      method: "POST",
      body: JSON.stringify({ messages, tools }),
    });
    return res.json();
  },
};
```
