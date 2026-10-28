"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Check,
  Clock3,
  Globe2,
  Shield,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AssistantText } from "@/components/chat/assistant-text";
import { ConfirmationCard } from "@/components/chat/confirmation-card";
import {
  CashForecastCard,
  ClientRiskCard,
  OverdueCard,
} from "@/components/chat/insight-cards";

const STORAGE_KEY = "paypilot_chat_session_v1";

type PromptTemplate = {
  icon: LucideIcon;
  category: string;
  badge: string;
  prompt: string;
  description: string;
};

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    icon: Zap,
    category: "Standard Draft",
    badge: "HITL Safe",
    prompt: "Invoice Acme Studio $120 for a logo refresh. Email buyer@personal.example.com. USD.",
    description: "Turn a messy note into a reviewable local draft — PayPal stays untouched until you confirm.",
  },
  {
    icon: Globe2,
    category: "Live FX Conversion",
    badge: "Frankfurter Live",
    prompt: "Client agreed ₹40,000 for mobile app bug fixes, email buyer@personal.example.com.",
    description: "Shows the live INR→USD rate and asks you to approve before drafting.",
  },
  {
    icon: Clock3,
    category: "Overdue Accounts",
    badge: "Auto Date Math",
    prompt: "Invoice Beta Labs $90 for code audit. Email beta@example.com. Due date was 5 days ago. USD.",
    description: "Understands “5 days ago”, marks the draft overdue, and unlocks reminders.",
  },
  {
    icon: BarChart3,
    category: "Cash Flow Inquiry",
    badge: "Deterministic",
    prompt: "What is my cash forecast for the next 6 weeks?",
    description: "Explains expected cash week by week from your real ledger — no invented totals.",
  },
];

export function ChatApp() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, setMessages, sendMessage, status, stop, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  const busy = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  // Restore messages from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to restore chat messages from localStorage", e);
    } finally {
      setIsRestored(true);
    }
  }, [setMessages]);

  // Persist messages to localStorage whenever they update
  useEffect(() => {
    if (!isRestored) return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Failed to persist chat messages to localStorage", e);
    }
  }, [messages, isRestored]);

  function clearSession(): void {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function submit(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }
    void sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col lg:grid lg:grid-cols-12 lg:divide-x lg:divide-zinc-200 dark:lg:divide-zinc-800">
      {/* Main Conversation Column (8 cols on desktop) */}
      <div className="flex h-full min-h-0 flex-col lg:col-span-8">
        {/* Session Memory Top Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 bg-zinc-50/50 px-4 py-2 text-xs dark:border-zinc-800/80 dark:bg-zinc-950/60">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              Session Memory Active
            </span>
            {messages.length > 0 ? (
              <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {messages.length} message{messages.length === 1 ? "" : "s"} saved locally
              </span>
            ) : null}
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={clearSession}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 shadow-xs transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              title="Clear conversation history and start a fresh session"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span>New Chat</span>
            </button>
          ) : null}
        </div>

        {/* Messages area */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 ${
            empty ? "flex items-center" : ""
          }`}
        >
          <div className={`mx-auto flex w-full max-w-3xl lg:max-w-4xl flex-col ${empty ? "gap-6" : "gap-5"}`}>
            {empty ? (
              <div className="space-y-6">
                {/* Hero Banner */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600 dark:bg-blue-400" />
                    <span>You confirm before PayPal • Sandbox</span>
                  </div>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
                    What should we invoice today?
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-sm text-zinc-700 dark:text-zinc-400">
                    Paste a client note or pick a starter below. I draft a local invoice for you to
                    review — PayPal only runs after you confirm.
                  </p>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PROMPT_TEMPLATES.map((item) => {
                    const Icon = item.icon;
                    return (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => submit(item.prompt)}
                      className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-800/60 dark:text-zinc-300">
                            {item.badge}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.category}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-700 dark:text-zinc-400">
                          {item.description}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-blue-600 group-hover:underline dark:text-blue-400">
                        <span>Try sample prompt</span>
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex flex-col gap-2 rounded-2xl p-4 transition ${
                    message.role === "user"
                      ? "border border-zinc-200 bg-zinc-100/80 dark:border-zinc-800/60 dark:bg-zinc-900/40"
                      : "border border-transparent bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold tracking-wider uppercase ${
                        message.role === "user"
                          ? "border border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700/80 dark:bg-zinc-800 dark:text-zinc-300"
                          : "border border-blue-500/30 bg-blue-600/10 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400"
                      }`}
                    >
                      {message.role === "user" ? (
                        "You"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          PayPilot AI
                        </span>
                      )}
                    </span>
                  </div>
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      if (!part.text.trim()) return null;
                      return message.role === "assistant" ? (
                        <AssistantText key={`${message.id}-text-${index}`} text={part.text} />
                      ) : (
                        <p
                          key={`${message.id}-text-${index}`}
                          className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200"
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
                    if (part.type === "tool-getCashForecast") {
                      return (
                        <CashForecastCard
                          key={part.toolCallId}
                          output={"output" in part ? part.output : undefined}
                          state={part.state}
                        />
                      );
                    }
                    if (part.type === "tool-getClientRisk") {
                      return (
                        <ClientRiskCard
                          key={part.toolCallId}
                          output={"output" in part ? part.output : undefined}
                          state={part.state}
                        />
                      );
                    }
                    if (part.type === "tool-listOverdue") {
                      return (
                        <OverdueCard
                          key={part.toolCallId}
                          output={"output" in part ? part.output : undefined}
                          state={part.state}
                        />
                      );
                    }
                    return null;
                  })}
                </article>
              ))
            )}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                Something went wrong: {error.message}
              </div>
            ) : null}

            {busy ? (
              <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent dark:border-zinc-400" />
                <span>
                  {status === "submitted" ? "Reading your request…" : "Preparing a clear reply…"}
                </span>
                <button
                  type="button"
                  className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
                  onClick={() => stop()}
                >
                  Stop
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-3xl lg:max-w-4xl space-y-2.5">
            {/* Quick-Action Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-medium text-zinc-500">Try:</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(PROMPT_TEMPLATES[0].prompt)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Zap className="h-3 w-3" aria-hidden />
                <span>USD Invoice</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(PROMPT_TEMPLATES[1].prompt)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Globe2 className="h-3 w-3" aria-hidden />
                <span>INR Quote</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(PROMPT_TEMPLATES[2].prompt)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Clock3 className="h-3 w-3" aria-hidden />
                <span>Overdue Notice</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(PROMPT_TEMPLATES[3].prompt)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <BarChart3 className="h-3 w-3" aria-hidden />
                <span>Cash Forecast</span>
              </button>
            </div>

            {/* Form */}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submit(input);
              }}
            >
              <input
                className="h-12 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none transition focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900/90"
                value={input}
                disabled={busy}
                placeholder="Paste a messy client agreement or instruction…"
                onChange={(event) => setInput(event.target.value)}
              />
              <button
                type="submit"
                disabled={busy || input.trim().length === 0}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#003087] px-5 text-sm font-semibold text-white shadow-md shadow-blue-900/30 transition hover:bg-[#00256c] active:scale-95 disabled:opacity-50"
              >
                <span>Send</span>
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Operations & Copilot Sidebar (4 cols on desktop) */}
      <div className="hidden h-full flex-col overflow-y-auto bg-zinc-50/50 p-6 lg:col-span-4 lg:flex dark:bg-zinc-950/40">
        <div className="space-y-6">
          {/* Rail Status */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Payment Rails & Status
              </p>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                <span className="text-zinc-500">PayPal Rail</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Sandbox REST v2 Active</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                <span className="text-zinc-500">AI Engine</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">Azure gpt-5-mini</span>
              </div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800/80">
                <span className="text-zinc-500">Live FX</span>
                <span className="text-zinc-800 dark:text-zinc-200">Frankfurter ECB Cache</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Persistence</span>
                <span className="text-zinc-800 dark:text-zinc-200">libSQL / SQLite Active</span>
              </div>
            </div>
          </div>

          {/* HITL Rule Card */}
          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              <span>Human-in-the-Loop Policy</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
              The AI parses unstructured conversations and drafts local invoices. PayPal is{" "}
              <strong>never contacted</strong> without your explicit confirmation in the UI.
            </p>

            <div className="mt-4 space-y-2 border-t border-blue-500/20 pt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                <span>Chat parses messy work & terms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                <span>Local DRAFT stored safely</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                <span>Human confirms amount & email</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">4.</span>
                <span>PayPal hosted link generated</span>
              </div>
            </div>
          </div>

          {/* Guardrails Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Active Guardrails
            </p>
            <ul className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                <span>Max invoice amount capped at $5,000</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                <span>Max 2 PayPal reminders / invoice / UTC day</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                <span>Live Frankfurter FX requires explicit confirmation</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                <span>XSS & HTML tags sanitized before storage</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
