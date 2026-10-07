"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";
import { ConfirmationCard } from "@/components/confirmation-card";

const EXAMPLES = [
  "Invoice Acme Studio $120 for a logo refresh. Email buyer@personal.example.com. USD.",
  "Client agreed ₹40,000 for a landing page, email buyer@personal.example.com.",
];

export function ChatApp() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }
    void sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-2xl items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">PayPilot</p>
            <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Freelancer payment agent
            </h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-zinc-500">
            <a className="underline" href="/invoices">
              Invoices
            </a>
            <a className="underline" href="/api/health">
              Health
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Describe finished work in chat. PayPilot drafts a local invoice. You confirm. Then it
              creates a PayPal sandbox share link — not before.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-xl border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  onClick={() => submit(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <article key={message.id} className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {message.role === "user" ? "You" : "PayPilot"}
              </p>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <p
                      key={`${message.id}-text-${index}`}
                      className="whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200"
                    >
                      {part.text}
                    </p>
                  );
                }
                if (part.type === "tool-proposeInvoice") {
                  return (
                    <ConfirmationCard
                      key={part.toolCallId}
                      output={"output" in part ? part.output : undefined}
                      state={part.state}
                    />
                  );
                }
                return null;
              })}
            </article>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
        ) : null}

        {busy ? (
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span>{status === "submitted" ? "Thinking…" : "Writing…"}</span>
            <button type="button" className="underline" onClick={() => stop()}>
              Stop
            </button>
          </div>
        ) : null}

        <form
          className="sticky bottom-4 mt-auto flex gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <input
            className="h-11 flex-1 rounded-xl bg-transparent px-3 text-sm text-zinc-900 outline-none dark:text-zinc-50"
            value={input}
            disabled={busy}
            placeholder="Paste a messy client chat…"
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="inline-flex h-11 items-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
