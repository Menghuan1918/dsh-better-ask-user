window.__ModuleLoader__.load({
  id: "dsh-better-ask-user",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  PendingQuestion: () => PendingQuestion,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// ../../Library/Application Support/dsh-tauri/dependencies/dsh/node_modules/@deepseek-ai/dsh-brand/lib/index.js
function brandString(value) {
  return value;
}

// src/client/contract/slots.ts
function settlePendingComposer(settle, failureMessage) {
  try {
    settle();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(failureMessage, { cause: error }));
  }
}
function planReviewOf(questions) {
  if (questions.length !== 1) return void 0;
  const question = questions[0];
  const intent = question.intent;
  if (intent?.kind !== "plan-review" || question.detail === void 0) return void 0;
  if (question.multiSelect === true) return void 0;
  const options = question.options ?? [];
  if (options.length > 2) return void 0;
  const approve = options.find((option) => option.label === intent.approve);
  if (approve === void 0) return void 0;
  const decline = options.find((option) => option.label !== intent.approve);
  return {
    id: question.id,
    question: question.question,
    plan: question.detail,
    ...intent.callId === void 0 ? {} : { callId: intent.callId },
    approve,
    ...decline === void 0 ? {} : { decline }
  };
}
var unnamedQuestionPrefix = Array.from(
  globalThis.crypto.getRandomValues(new Uint8Array(16)),
  (byte) => byte.toString(16).padStart(2, "0")
).join("");
var nextQuestionKey = 0;
var rejectionMessages = {
  ASK_ABORTED: "ask_user_question was aborted before the user answered",
  ASK_CANCELLED: "the user cancelled ask_user_question",
  ASK_TIMED_OUT: "ask_user_question timed out before the user answered"
};
function questionError(code) {
  const error = new Error(rejectionMessages[code]);
  error.name = "UserQuestionError";
  error.code = code;
  return error;
}
function createWaterfallRequest(deadline, signal, onSettle) {
  const completion = Promise.withResolvers();
  const delegated = Symbol("pending question delegated");
  let settled = false;
  const finish = (settle) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener("abort", onAbort);
    settle();
    onSettle(channel);
  };
  const onAbort = () => {
    finish(() => {
      completion.reject(questionError("ASK_ABORTED"));
    });
  };
  const channel = {
    deadline,
    resolve: (answer) => {
      finish(() => {
        completion.resolve(answer);
      });
    },
    reject: (code) => {
      finish(() => {
        completion.reject(questionError(code));
      });
    },
    delegate: () => {
      finish(() => {
        completion.reject(delegated);
      });
    }
  };
  if (signal !== void 0) {
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  }
  return { channel, result: completion.promise, isDelegation: (reason) => reason === delegated };
}
var PendingQuestion = class _PendingQuestion {
  /** Presentation discriminator used by Session pending-interaction consumers. */
  kind;
  /** Render identity and request key for the Session-scoped draft store. */
  key;
  /** Agent/Session identity owning the request. */
  sessionId;
  /** The request's question list. */
  questions;
  /** Tool call identity; absent for a blocking request that carried no `wait`. */
  callId;
  /**
   * Recorded answers of a call that already settled. Present only on a
   * read-only review card, which the tool call row builds from its own
   * transcript so a finished question can be read back in the panel that
   * asked it. Such a card has no answer channel and no countdown.
   */
  review;
  /**
   * What closing the panel does. A card keyed by tool call stays reachable
   * from its tool call row, so closing only withdraws the panel (`hide`) and
   * persists nothing. A card the Host never named has no way back, so closing
   * it ends the request (`cancel`).
   */
  dismissal;
  #state = "open";
  #waterfall;
  #rpc;
  #seat;
  #timedWait = false;
  #timer;
  #deadline;
  #remainingMs;
  #focused = false;
  #engaged = false;
  #held = false;
  #closed = false;
  #siblings;
  #listeners = /* @__PURE__ */ new Set();
  #snapshot;
  #waitMs;
  #timeoutMode = "native";
  #defaultAnswer;
  /**
   * @param sessionId - Agent/Session identity owning the request.
   * @param questions - complete question batch.
   * @param callId - tool call identity when the Host named one.
   * @param siblings - keys of every card currently registered for the Session, for draft pruning.
   * @param review - recorded answers of a settled call, making this a read-only card.
   */
  constructor(sessionId, questions, callId, siblings, review, settings) {
    this.sessionId = sessionId;
    this.questions = questions;
    this.#waitMs = settings?.waitMs;
    this.#timeoutMode = settings?.timeoutMode ?? "native";
    this.#defaultAnswer = settings?.defaultAnswer;
    this.kind = planReviewOf(questions) === void 0 ? "question" : "plan-review";
    this.callId = callId;
    this.review = review;
    this.dismissal = callId === void 0 ? "cancel" : "hide";
    this.#siblings = siblings;
    if (callId === void 0) nextQuestionKey += 1;
    this.key = callId === void 0 ? `question:${unnamedQuestionPrefix}:${String(nextQuestionKey)}` : _PendingQuestion.keyOf(sessionId, callId);
    this.#snapshot = this.createSnapshot();
  }
  /**
   * Card key of a tool call, shared by every source that names one. The Host
   * request and the Session projection carry the branded `ToolCallId`; a
   * transcript row carries the same wire value as a plain string.
   * @param sessionId - owning Session.
   * @param callId - tool call identity, branded or as a transcript spells it.
   * @returns the render identity and draft key.
   */
  static keyOf(sessionId, callId) {
    return `question:${String(sessionId)}:${callId}`;
  }
  /**
   * Draft keys that are still live in this Session, this card included.
   * @returns keys the draft store must keep; everything else is stale.
   */
  liveKeys() {
    return this.#siblings?.() ?? [this.key];
  }
  /** Subscribe to card state changes. */
  subscribe = (listener) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  /** Read the stable current card state. */
  snapshot = () => this.#snapshot;
  /** Observable snapshot read by the renderer's keyed Hook. */
  getSnapshot = this.snapshot;
  createSnapshot() {
    const channel = this.#waterfall !== void 0 ? "waterfall" : this.#state === "continued" && this.#rpc !== void 0 ? "rpc" : "none";
    const waitState = this.#state === "continued" ? "continued" : this.#held ? "waiting" : this.#engaged ? "editing" : this.#focused ? "focused" : "counting";
    return {
      state: this.#state,
      waitState,
      countdown: this.#timedWait ? {
        remainingMs: this.#deadline === void 0 ? this.#remainingMs ?? 0 : Math.max(0, this.#deadline - Date.now()),
        running: this.#deadline !== void 0
      } : void 0,
      channel,
      closed: this.#closed,
      ...this.#timedWait ? { waitMs: this.#waitMs, timeoutMode: this.#timeoutMode } : {}
    };
  }
  publish() {
    this.#snapshot = this.createSnapshot();
    this.#reschedule();
    for (const listener of this.#listeners) listener();
  }
  /**
   * Own the countdown here rather than in a mounted component: the panel can be
   * hidden and remounted while the request stands, and a timer that died with
   * the component would leave the tool call waiting past its deadline.
   */
  #reschedule() {
    const wanted = this.#deadline !== void 0 && !this.#closed;
    if (wanted === (this.#timer !== void 0)) return;
    if (!wanted) {
      clearInterval(this.#timer);
      this.#timer = void 0;
      return;
    }
    this.#timer = setInterval(() => {
      this.#tick();
    }, 1e3);
  }
  #tick() {
    const deadline = this.#deadline;
    if (deadline === void 0) return;
    if (Date.now() >= deadline) {
      this.timeout();
      return;
    }
    this.publish();
  }
  /**
   * Attach the live waterfall of a forwarded request.
   * @param channel - request channel created by {@link createWaterfallRequest}.
   */
  attachWaterfall(channel) {
    this.#waterfall = channel;
    this.#timedWait = channel.deadline !== void 0;
    if (!this.#held && !this.#engaged) {
      this.#deadline = channel.deadline;
      if (this.#focused && channel.deadline !== void 0) {
        this.#remainingMs = Math.max(0, channel.deadline - Date.now());
        this.#deadline = void 0;
      }
    }
    this.publish();
  }
  /**
   * Drop a waterfall channel that settled or was cancelled; the card stays.
   * @param channel - the channel that ended.
   */
  detachWaterfall(channel) {
    if (this.#waterfall !== channel) return;
    this.#waterfall = void 0;
    this.#timedWait = false;
    this.#deadline = void 0;
    this.publish();
  }
  /**
   * Whether a live waterfall is attached.
   * @returns whether the pending Host request still accepts settlement.
   */
  hasWaterfall() {
    return this.#waterfall !== void 0;
  }
  /**
   * Attach the Remote answer path used once the question is continued.
   * @param channel - Remote calls bound to this Session and call.
   */
  attachRpc(channel) {
    this.#rpc = channel;
    this.publish();
  }
  /**
   * Attach the composer seat this card is published into.
   * @param seat - withdrawal of the published panel, owned by the card registry.
   */
  attachSeat(seat) {
    this.#seat = seat;
  }
  /**
   * Copy the projection row state.
   * @param state - `open` or `continued`.
   */
  setState(state) {
    if (this.#state === state) return;
    this.#state = state;
    this.publish();
  }
  /** Stop this Client's countdown indefinitely; the waterfall then waits like a blocking question. */
  takeTime() {
    if (this.#held) return;
    this.#held = true;
    this.#focused = false;
    this.#remainingMs = void 0;
    this.#deadline = void 0;
    this.publish();
  }
  /**
   * Record focus even before the request arrives, freezing a pristine countdown once attached.
   * @param now - current Client epoch time.
   */
  holdFocus(now = Date.now()) {
    if (this.#held || this.#engaged || this.#focused) return;
    this.#remainingMs = this.#deadline === void 0 ? void 0 : Math.max(0, this.#deadline - now);
    this.#deadline = void 0;
    this.#focused = true;
    this.publish();
  }
  /**
   * Resume a pristine countdown after the answer surface loses focus.
   * @param now - current Client epoch time.
   */
  releaseFocus(now = Date.now()) {
    if (!this.#focused) return;
    this.#focused = false;
    this.#deadline = this.#timedWait && this.#remainingMs !== void 0 ? now + this.#remainingMs : void 0;
    this.#remainingMs = void 0;
    this.publish();
  }
  /**
   * Keep the first edited draft answerable without a foreground deadline.
   * @param now - current Client epoch time used to preserve the remaining duration.
   */
  engage(now = Date.now()) {
    if (this.#held || this.#engaged) return;
    if (this.#remainingMs === void 0 && this.#deadline !== void 0) {
      this.#remainingMs = Math.max(0, this.#deadline - now);
    }
    this.#engaged = true;
    this.#focused = false;
    this.#deadline = void 0;
    this.publish();
  }
  /**
   * Extend the foreground countdown to the configured window. Called on every
   * real answer input (option click, text edit, page navigation, skip).
   * @param now - current Client epoch time.
   */
  bump(now = Date.now()) {
    if (this.#waitMs === void 0 || !this.#timedWait || this.#held) return;
    if (this.#waterfall === void 0 || this.#closed) return;
    this.#focused = false;
    this.#engaged = false;
    this.#remainingMs = void 0;
    this.#deadline = now + this.#waitMs;
    this.publish();
  }
  /** Settle with the host-authored default answer in default timeout mode. */
  autoSelect() {
    if (this.#held || this.#engaged || this.#focused) return;
    const channel = this.#waterfall;
    if (channel === void 0) return;
    const answer = this.#defaultAnswer;
    if (this.#timeoutMode !== "default" || answer === void 0) {
      this.timeout();
      return;
    }
    this.#waterfall = void 0;
    this.#timedWait = false;
    this.#deadline = void 0;
    channel.resolve(answer);
    this.publish();
  }
  /** Local countdown reached zero: default-select or settle with `ASK_TIMED_OUT`. */
  timeout() {
    if (this.#held || this.#engaged || this.#focused) return;
    if (this.#timeoutMode === "default" && this.#defaultAnswer !== void 0) {
      this.autoSelect();
      return;
    }
    const channel = this.#waterfall;
    if (channel === void 0) return;
    this.#waterfall = void 0;
    this.#timedWait = false;
    this.#deadline = void 0;
    channel.reject("ASK_TIMED_OUT");
    this.publish();
  }
  /** Hand a live waterfall to the next listener when this presentation domain unloads. */
  delegate() {
    this.#waterfall?.delegate();
  }
  /** Mark the card removed from the registry; the mounted composer clears its draft. */
  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.publish();
  }
  /**
   * Submit the whole answer batch through the live waterfall, or through the
   * Remote path once the question is continued.
   * @param answer - complete structured answer batch.
   */
  answer(answer) {
    const waterfall = this.#waterfall;
    if (waterfall !== void 0) {
      return settlePendingComposer(() => {
        waterfall.resolve(answer);
      }, "pending question settlement failed");
    }
    const rpc = this.#rpc;
    if (this.#state === "continued" && rpc !== void 0) {
      return rpc.answer(answer).then((accepted) => {
        if (!accepted) throw new Error("this question is no longer answerable");
      });
    }
    return Promise.reject(new Error("no channel accepts an answer yet"));
  }
  /**
   * Close the panel. A tool-call-keyed card only leaves the composer seat: the
   * request stands, the countdown keeps running here, and the tool call row
   * reopens it. A card the Host never named ends its request instead, because
   * nothing could bring it back.
   */
  dismiss() {
    if (this.dismissal === "hide") {
      return settlePendingComposer(() => {
        this.#seat?.hide();
      }, "pending question hide failed");
    }
    const waterfall = this.#waterfall;
    if (waterfall === void 0) return Promise.reject(new Error("no channel accepts a cancellation yet"));
    return settlePendingComposer(() => {
      waterfall.reject("ASK_CANCELLED");
    }, "pending question cancellation failed");
  }
};

// src/client/draft-store.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function createQuestionDraftStore() {
  return (0, import_dsh_client_store.defineStore)({
    init: () => ({ progressByRequest: {} }),
    persist: "dsh.user-questions.drafts.v1",
    actions: {
      replace: (draft, requestKey, progress) => {
        draft.progressByRequest[requestKey] = progress;
      },
      clear: (draft, requestKey) => {
        draft.progressByRequest = Object.fromEntries(
          Object.entries(draft.progressByRequest).filter(([key]) => key !== requestKey)
        );
      },
      prune: (draft, keep) => {
        const live = new Set(keep);
        draft.progressByRequest = Object.fromEntries(
          Object.entries(draft.progressByRequest).filter(([key]) => live.has(key))
        );
      }
    }
  });
}

// src/client/AskHistoryRow.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/AskHistoryRow.module.css
var css = ".bau-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 24px;\n  min-width: 0;\n  color: var(--dsw-alias-label-secondary);\n}\n.bau-icon {\n  display: inline-flex;\n  align-items: center;\n  flex: none;\n  color: var(--dsw-alias-label-tertiary);\n}\n.bau-title {\n  flex: none;\n  font: var(--dsw-font-xs-strong-13);\n  color: var(--dsw-alias-label-secondary);\n}\n.bau-summary {\n  min-width: 0;\n  flex: 1;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font: var(--dsw-font-xs-13);\n  color: var(--dsw-alias-label-tertiary);\n}\n.bau-open {\n  flex: none;\n  cursor: pointer;\n  border: .5px solid var(--dsw-alias-border-l4);\n  border-radius: 999px;\n  background: var(--dsw-alias-bg-base);\n  color: var(--dsw-alias-label-secondary);\n  padding: 1px 8px;\n  font: var(--dsw-font-xxs-12);\n  line-height: 16px;\n}\n.bau-open:hover {\n  background: var(--dsw-alias-interactive-bg-hover-solid);\n  color: var(--dsw-alias-label-primary);\n}\n.bau-open:focus-visible {\n  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n  outline-offset: 1px;\n}";
var id = "dsh-better-ask-user/AskHistoryRow.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(id) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-better-ask-user";
  tag.dataset.pluginCss = id;
  tag.textContent = css;
  document.head.appendChild(tag);
}
var AskHistoryRow_default = { "row": "bau-row", "icon": "bau-icon", "title": "bau-title", "summary": "bau-summary", "open": "bau-open" };

// src/client/AskHistoryRow.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function resultText(content) {
  const parts = [];
  for (const block of content) {
    if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") continue;
    parts.push(block.text);
  }
  return parts.length === 0 ? void 0 : parts.join("\n");
}
function questionList(argsRaw) {
  const parsed = parseJson(argsRaw);
  if (!isRecord(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length === 0) return void 0;
  const questions = [];
  for (const candidate of parsed.questions) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.question !== "string") return void 0;
    questions.push({
      id: candidate.id,
      question: candidate.question,
      ...typeof candidate.header === "string" ? { header: candidate.header } : {},
      ...Array.isArray(candidate.options) ? {
        options: candidate.options.flatMap((option) => isRecord(option) && typeof option.label === "string" ? [{
          label: option.label,
          ...typeof option.description === "string" ? { description: option.description } : {}
        }] : [])
      } : {},
      ...typeof candidate.multi_select === "boolean" ? { multi_select: candidate.multi_select } : {}
    });
  }
  return questions;
}
function answerList(text) {
  if (text === void 0) return void 0;
  const parsed = parseJson(text);
  if (!isRecord(parsed) || !Array.isArray(parsed.answers)) return void 0;
  const answers = [];
  for (const candidate of parsed.answers) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || !Array.isArray(candidate.selected) || !candidate.selected.every((value) => typeof value === "string") || candidate.custom !== void 0 && typeof candidate.custom !== "string") return void 0;
    answers.push({
      id: candidate.id,
      selected: candidate.selected,
      ...candidate.custom === void 0 ? {} : { custom: candidate.custom }
    });
  }
  return answers;
}
function isPending(text) {
  if (text === void 0) return false;
  const parsed = parseJson(text);
  return isRecord(parsed) && parsed.pending === true;
}
function AskHistoryRow({
  callId,
  block,
  phase,
  revealPanel,
  reviewPanel,
  t
}) {
  const argsRaw = "kind" in block ? block.call?.argsRaw ?? "" : block.argsRaw;
  const output = "kind" in block ? resultText(block.content) : void 0;
  const questions = questionList(argsRaw);
  const answers = answerList(output);
  const record = questions !== void 0 && answers !== void 0 ? { questions, answers } : void 0;
  const summary = questions?.[0]?.question.split("\n").find((line) => line.trim() !== "")?.trim() ?? t("history.title");
  const review = record !== void 0;
  const action = review ? () => {
    reviewPanel(callId, record);
  } : isPending(output) || phase === "start" ? () => {
    revealPanel(callId);
  } : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: AskHistoryRow_default.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: AskHistoryRow_default.icon, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconQuestionOutline14, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: AskHistoryRow_default.title, children: t("history.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: AskHistoryRow_default.summary, title: summary, children: summary }),
    action !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        className: AskHistoryRow_default.open,
        onClick: action,
        "aria-label": review ? t("history.review") : t("history.reopen"),
        children: review ? t("history.review") : t("history.reopen")
      }
    )
  ] });
}

// src/client/QuestionComposer.tsx
var import_react2 = require("react");

// ../deepseek-harness/node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
var clsx_default = clsx;

// src/client/QuestionComposer.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/PlanReviewPanel.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/PlanReviewPanel.module.css
var css2 = ".bau-frame {\n  display: flex;\n  justify-content: center;\n  /* Sides = clearance + 16px: the card lands on the shared content width\n     (input card - 32) at every viewport. */\n  padding: 6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;\n}\n\n.bau-card {\n  display: flex;\n  overflow: hidden;\n  flex-direction: column;\n  width: 100%;\n  max-width: var(--dsh-chat-content-width);\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l2);\n  border: 0;\n  border-radius: var(--dsw-radius-xl);\n  background: var(--dsw-specific-input-major);\n  box-shadow: var(--dsw-elevation-panel);\n  color: var(--dsw-alias-label-primary);\n}\n\n.bau-card,\n.bau-card * {\n  box-sizing: border-box;\n}\n\n/* Tinted full-width header band, as on the approval takeover. */\n.bau-strip {\n  display: flex;\n  align-items: center;\n  flex-shrink: 0;\n  gap: 8px;\n  padding: 12px 16px;\n  background: var(--dsw-alias-state-warn-tertiary);\n  color: var(--dsw-alias-state-warn-primary);\n  font-size: 14px;\n  line-height: 20px;\n}\n\n.bau-footer {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  flex-shrink: 0;\n  gap: 12px;\n  padding: 8px 16px 12px;\n}\n\n.bau-feedback {\n  min-height: 16px;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\n.bau-actions {\n  display: flex;\n  align-items: center;\n  flex-shrink: 0;\n  gap: 8px;\n}\n\n.bau-summary {\n  min-width: 0;\n  padding: 14px 16px 12px;\n}\n\n.bau-title {\n  margin: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 15px;\n  font-weight: 500;\n  line-height: 22px;\n}\n\n.bau-description {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 2;\n  overflow: hidden;\n  margin: 8px 0 0;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 14px;\n  line-height: 24px;\n}\n\n.bau-discuss {\n  gap: 6px;\n}\n\n@media (max-width: 720px) {\n  .bau-card {\n    border-radius: var(--dsw-radius-xl);\n  }\n\n  .bau-footer {\n    align-items: flex-end;\n    padding: 8px 12px 10px;\n  }\n}\n\n.bau-previewActions {\n  margin-left: auto;\n  display: flex;\n  align-items: center;\n}\n\n/* Better ask-user: long plan text and narrow screens. */\n.bau-title,\n.bau-description,\n.bau-summary,\n.bau-strip {\n  min-width: 0;\n  overflow-wrap: anywhere;\n  word-break: break-word;\n}\n\n.bau-title {\n  max-height: 30vh;\n  overflow-y: auto;\n}\n\n@media (max-width: 720px) {\n  .bau-card {\n    max-height: calc(100vh - 160px);\n    max-height: calc(100dvh - 160px);\n  }\n\n  .bau-title {\n    max-height: 24vh;\n    max-height: 24dvh;\n  }\n\n  .bau-footer {\n    flex-wrap: wrap;\n  }\n\n  .bau-actions {\n    flex-wrap: wrap;\n  }\n}\n";
var id2 = "dsh-better-ask-user/PlanReviewPanel.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(id2) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-better-ask-user";
  tag.dataset.pluginCss = id2;
  tag.textContent = css2;
  document.head.appendChild(tag);
}
var PlanReviewPanel_default = { "frame": "bau-frame", "card": "bau-card", "strip": "bau-strip", "footer": "bau-footer", "feedback": "bau-feedback", "actions": "bau-actions", "summary": "bau-summary", "title": "bau-title", "description": "bau-description", "discuss": "bau-discuss", "previewActions": "bau-previewActions" };

// src/client/PlanReviewPanel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function tooltip(description) {
  return description === void 0 ? {} : { title: description };
}
function PlanReviewPanel({ pending, review, t, renderSlot }) {
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const settle = (send, remote = false) => {
    setBusy(true);
    setError(null);
    void send().then(() => {
      if (!remote) return;
      setBusy(false);
      void pending.dismiss().catch(() => {
        setError(t("status.sent"));
      });
    }).catch((cause) => {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  };
  const decide = (label) => {
    settle(() => pending.answer({ answers: [{ id: review.id, selected: [label] }] }), pending.snapshot().channel === "rpc");
  };
  const summary = (0, import_react.useMemo)(() => {
    const title = (0, import_dsh_client_ui_primitives2.extractMarkdownPlainText)(review.plan, { mode: "first-line" });
    const description = (0, import_dsh_client_ui_primitives2.extractMarkdownPlainText)(review.plan, { mode: "first-paragraph" });
    return { title, description: description === title ? "" : description };
  }, [review.plan]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: PlanReviewPanel_default.frame, "data-plan-review-key": pending.key, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: PlanReviewPanel_default.card, "aria-label": review.question, "aria-busy": busy, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: PlanReviewPanel_default.strip, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: busy ? "ongoing" : "warning" }),
      t("plan.header"),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: PlanReviewPanel_default.previewActions, children: renderSlot("conversation.plan-review.actions", { review, requestKey: pending.key }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: PlanReviewPanel_default.summary, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: PlanReviewPanel_default.title, children: summary.title }),
      summary.description !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: PlanReviewPanel_default.description, children: summary.description })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: PlanReviewPanel_default.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: PlanReviewPanel_default.feedback, role: "status", children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: PlanReviewPanel_default.actions, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_dsh_client_ui_primitives2.Button,
          {
            variant: "outline",
            className: PlanReviewPanel_default.discuss,
            icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconEditOutlineRegular, { size: 14 }),
            disabled: busy,
            onClick: () => {
              settle(() => pending.dismiss());
            },
            children: t("plan.discuss")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_dsh_client_ui_primitives2.Button,
          {
            variant: "primary",
            ...tooltip(review.approve.description),
            disabled: busy,
            onClick: () => {
              decide(review.approve.label);
            },
            children: t("plan.approve")
          }
        )
      ] })
    ] })
  ] }) });
}

// src/client/QuestionComposer.module.css
var css3 = "/* The takeover seats where the input card sits, centered on the InputBar\n   axis at the shared content width (input card - 32): sides = clearance +\n   16px so the relation also holds on narrow viewports. */\n.bau-frame {\n  display: flex;\n  justify-content: center;\n  padding: 6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;\n}\n\n/* Figma Input 973:36348 body over the 1019:36938 header: no banner strip \u2014\n   the card keeps zero padding and sections carry their own insets. */\n.bau-card {\n  display: flex;\n  flex-direction: column;\n  width: 100%;\n  max-width: var(--dsh-chat-content-width);\n  /* Composer seat sits in a fixed-height conversation column (overflow\n     hidden): cap the card against the viewport and scroll the option list\n     so header and footer actions stay reachable on long batches. */\n  max-height: min(60vh, 520px);\n  padding: 0 0 10px;\n  border: 0;\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l2-darkmode-thin);\n  border-radius: var(--dsw-radius-xl);\n  background: var(--dsw-specific-input-major);\n  box-shadow: var(--dsw-elevation-panel);\n  color: var(--dsw-alias-label-primary);\n  overflow: hidden;\n  /* Elevated surface in dark, same as the menus: the body inside scrolls\n     once the card hits the cap above, so the thumb takes the l2 pair. Declared\n     on the card because the elevation belongs to the surface, and the custom\n     properties inherit down to `.bau-body` (see ui-theme styles/scrollbar.bau-css\n     for the rebinding contract). */\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);\n}\n\n.bau-card,\n.bau-card * {\n  box-sizing: border-box;\n}\n\n/* Collapsed to the header strip: drop the height cap and the inner scroll\n   seat so the card hugs the title row, freeing the viewport for the\n   conversation above while the question stays pending. */\n.bau-cardMinimized {\n  max-height: none;\n}\n\n/* The header strip is the whole card when collapsed: the title row needs\n   bottom padding once the body that normally carries it is hidden. */\n.bau-cardMinimized .bau-header {\n  padding-bottom: 14px;\n}\n\n/* Header button group: minimize sits next to the close action, both on the\n   same 24px icon-button grid. */\n.bau-headerActions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex-shrink: 0;\n}\n\n.bau-waitButton {\n  white-space: nowrap;\n}\n\n.bau-waitStatus {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  line-height: 24px;\n  white-space: nowrap;\n}\n\n/* Figma 1019:36938 header, user-tuned: heading block left, close right; the\n   pager sits in the footer to balance the card. */\n.bau-header {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 16px;\n  flex-shrink: 0;\n  padding: 20px 16px 0 24px;\n}\n\n.bau-headingBlock {\n  min-width: 0;\n}\n\n.bau-eyebrow {\n  /* Eyebrow-to-title gap widened from the figma 2px (user-tuned). */\n  margin-bottom: 5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\n.bau-title {\n  margin: 0;\n  font-size: 16px;\n  line-height: 22px;\n  font-weight: 500;\n}\n\n.bau-detail {\n  margin: 0 2px 8px;\n}\n\n.bau-footerActions {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  flex-shrink: 0;\n}\n\n.bau-pager {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  flex-shrink: 0;\n}\n\n.bau-progress {\n  padding: 0 4px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 14px;\n  line-height: 24px;\n  font-weight: 500;\n  white-space: nowrap;\n  /* Narrow the plain spaces around the slash without touching glyph tracking. */\n  word-spacing: -2px;\n}\n\n.bau-iconButton {\n  display: grid;\n  place-items: center;\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: none;\n  border-radius: 999px;\n  corner-shape: round;\n  background: transparent;\n  color: var(--dsw-alias-label-tertiary);\n  cursor: pointer;\n}\n\n.bau-iconButton:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.bau-iconButton:disabled {\n  color: var(--dsw-alias-label-dimmed);\n  cursor: default;\n}\n\n.bau-body {\n  display: flex;\n  flex: 1 1 auto;\n  flex-direction: column;\n  min-height: 0;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n.bau-options {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  margin: 8px 0 0;\n  padding: 4px 12px;\n}\n\n.bau-option {\n  display: flex;\n  /* flex-start, not center: with a wrapped description the indicator must\n     stay on the FIRST line (centering drifts it down the taller copy block).\n     The 8px padding makes a single-line row 40px exactly, so nothing reads\n     as top-heavy; .bau-number/.bau-checkbox re-center against the first line box. */\n  align-items: flex-start;\n  gap: 8px;\n  width: 100%;\n  min-height: 40px;\n  /* Rows are the scroll content, never the slack absorber: a shrinkable row\n     collapses to min-height while its wrapped copy keeps the taller\n     intrinsic height, and centered content then paints outside the row box \u2014\n     over the title and the next row. Overflow belongs to .bau-options. */\n  flex-shrink: 0;\n  padding: 8px 12px 8px 8px;\n  border: 1px solid transparent;\n  border-radius: var(--dsw-radius-md);\n  background: transparent;\n  color: inherit;\n  text-align: left;\n  cursor: pointer;\n  transition: background-color 120ms ease, border-color 120ms ease;\n}\n\n.bau-option:hover:not(:disabled),\n.bau-optionSelected {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.bau-optionSelected {\n  border-color: var(--dsw-alias-border-l2);\n}\n\n.bau-option:disabled {\n  cursor: default;\n}\n\n/* Leading indicator (20\xD720): single-select shows the option\n   number, multi-select swaps in a checkbox; the custom-answer row follows \u2014\n   its checkbox mirrors the typed draft (styling only, exclusivity holds). */\n.bau-number {\n  display: grid;\n  place-items: center;\n  flex: 0 0 20px;\n  width: 20px;\n  height: 20px;\n  /* (24px first-line box \u2212 20px indicator) / 2: centers the indicator against\n     the first text line under the row's flex-start alignment. */\n  margin-top: 2px;\n  border-radius: var(--dsw-radius-xs);\n  background: var(--dsw-alias-bg-overlay);\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n  font-weight: 500;\n  line-height: 18px;\n}\n\n/* Multi-select box (figma 1055:41594, user-tuned down to 14\xD714): a radius-4\n   box centered in the 20px indicator seat; the box itself is the ::before\n   layer so the check icon stacks over it in the same grid cell. */\n.bau-checkbox {\n  display: grid;\n  place-items: center;\n  flex: 0 0 20px;\n  width: 20px;\n  height: 20px;\n  /* Same first-line centering as .bau-number under flex-start alignment. */\n  margin-top: 2px;\n}\n\n.bau-checkbox::before {\n  content: '';\n  grid-area: 1 / 1;\n  width: 14px;\n  height: 14px;\n  border: 0.5px solid var(--dsw-alias-border-l4);\n  border-radius: var(--dsw-radius-xs);\n  transition: background-color 120ms ease, border-color 120ms ease;\n}\n\n.bau-checkbox > svg {\n  grid-area: 1 / 1;\n}\n\n/* Checked: label-primary fill with a primary-foreground check \u2014 the pair\n   inverts with the theme (dark fill in light mode, light fill in dark mode). */\n.bau-checkboxChecked {\n  color: var(--dsw-alias-label-primary-foreground);\n}\n\n.bau-checkboxChecked::before {\n  border-color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-label-primary);\n}\n\n.bau-optionCopy {\n  min-width: 0;\n  flex: 1;\n}\n\n.bau-optionLine {\n  display: flex;\n  align-items: baseline;\n  flex-wrap: wrap;\n  gap: 2px 6px;\n}\n\n.bau-optionLabel {\n  font-size: 14px;\n  line-height: 24px;\n  font-weight: 500;\n}\n\n.bau-badge {\n  padding: 0 4px;\n  border-radius: var(--dsw-radius-xs);\n  background: var(--dsw-specific-sidebar-nav-item-active-accent);\n  color: var(--dsw-alias-button-info-fill);\n  font-size: 11px;\n  line-height: 18px;\n  font-weight: 600;\n}\n\n.bau-description {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 14px;\n  line-height: 24px;\n  font-weight: 400;\n}\n\n/* Read-only note standing in for a question the user skipped: it takes the\n   option rows' horizontal padding so it lines up with the choices above it. */\n.bau-reviewNote {\n  margin: 0;\n  padding: 8px 12px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 14px;\n  line-height: 24px;\n}\n\n/* Custom answer row (figma 973:36427): an option-shaped row whose copy is an\n   inline text input; focus or a typed draft gives it the selected look.\n   While a single-select option is chosen, focus alone does not apply that\n   look, so the radio group shows one selection; typing clears the option. */\n.bau-customRow {\n  display: flex;\n  /* Same first-line alignment as .bau-option \u2014 the indicator seat carries the\n     2px re-centering margin. */\n  align-items: flex-start;\n  gap: 8px;\n  width: 100%;\n  min-height: 40px;\n  /* Same reason as .bau-option: the custom row is scroll content, and shrinking\n     it pushes the inline input past the footer. */\n  flex-shrink: 0;\n  padding: 8px 12px 8px 8px;\n  border: 1px solid transparent;\n  border-radius: var(--dsw-radius-md);\n  transition: background-color 120ms ease, border-color 120ms ease;\n}\n\n.bau-customRow:hover,\n.bau-customRow:focus-within:not(.bau-customRowYielded),\n.bau-customRowActive {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.bau-customRow:focus-within:not(.bau-customRowYielded),\n.bau-customRowActive {\n  border-color: var(--dsw-alias-border-l2);\n}\n\n/* Auto-growing free-text answer (see AnswerField): mirror and textarea share\n   one grid cell, the mirror sizes it, and the textarea stretches to it. The\n   two layers MUST keep identical type, padding and wrapping \u2014 a mismatch\n   makes the box the wrong height for the text the user is typing. */\n.bau-field {\n  display: grid;\n  min-width: 0;\n  --dsh-answer-field-padding: 0;\n}\n\n.bau-field > * {\n  grid-area: 1 / 1;\n  min-width: 0;\n  padding: var(--dsh-answer-field-padding);\n  font: inherit;\n  font-size: 14px;\n  line-height: 24px;\n  white-space: pre-wrap;\n  word-break: break-word;\n  overflow-wrap: anywhere;\n}\n\n/* The height ruler, never painted. Growth stops at 6 lines: the card body is\n   capped at 520px and still owes that budget to the title, the option rows and\n   the footer actions, so a long answer scrolls in the textarea instead of\n   pushing the choices it belongs to out of view.\n   content-box overrides the card-wide border-box so the cap counts TEXT lines\n   in both variants: under border-box the block variant's 16px of vertical\n   padding eats two thirds of a line and the sixth one arrives as an 8px sliver.\n   Width is unaffected \u2014 a stretched grid item's used width comes from the\n   track, not from this box-sizing. */\n.bau-fieldMirror {\n  box-sizing: content-box;\n  max-height: 144px;\n  overflow: hidden;\n  visibility: hidden;\n}\n\n.bau-fieldInput {\n  resize: none;\n  /* The stack's only scrollport: past the mirror's cap the field stops growing\n     and this scrolls. */\n  overflow-y: auto;\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  caret-color: var(--dsw-alias-state-business-primary);\n}\n\n.bau-fieldInput::placeholder {\n  color: var(--dsw-alias-label-caption);\n}\n\n/* Inline variant: the custom row's copy column, borrowing the row's chrome. */\n.bau-customInline {\n  flex: 1;\n}\n\n/* Optionless question: the free-form answer is the whole body, so it carries\n   its own frame. The 12px side margins add to the .bau-options 12px padding so both\n   edges align with the title's 24px inset; two lines are reserved before the\n   answer starts growing. */\n.bau-customBlock {\n  min-height: 64px;\n  flex-shrink: 0;\n  margin: 0 12px;\n  border: 0.5px solid var(--dsw-alias-border-l4);\n  border-radius: var(--dsw-radius-lg);\n  background: var(--dsw-alias-bg-module-platform);\n  --dsh-answer-field-padding: 8px 12px;\n}\n\n.bau-customBlock:focus-within {\n  border-color: var(--dsw-alias-state-business-primary);\n}\n\n.bau-footer {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  flex-shrink: 0;\n  margin-top: 12px;\n  padding: 0 10px 0 18px;\n}\n\n.bau-feedback {\n  flex: 1;\n  min-height: 16px;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n  text-align: right;\n}\n\n@media (max-width: 720px) {\n  .bau-card {\n    border-radius: var(--dsw-radius-xl);\n  }\n\n  .bau-header {\n    padding: 10px 12px 0 18px;\n  }\n\n  .bau-options {\n    padding: 4px 8px;\n  }\n\n  .bau-title {\n    font-size: 15px;\n    line-height: 21px;\n  }\n\n  .bau-option,\n  .bau-customRow {\n    padding: 8px 6px;\n  }\n\n  .bau-footer {\n    align-items: flex-end;\n    padding: 0 10px;\n  }\n\n  .bau-footerActions {\n    flex-shrink: 0;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .bau-option,\n  .bau-customRow {\n    transition: none;\n  }\n}\n\n/* \u2500\u2500 Better ask-user adaptations: markdown / long text / narrow screens \u2500\u2500 */\n.bau-title,\n.bau-eyebrow,\n.bau-optionLabel,\n.bau-description {\n  min-width: 0;\n  overflow-wrap: anywhere;\n  word-break: break-word;\n}\n\n.bau-title {\n  max-height: 30vh;\n  overflow-y: auto;\n}\n\n.bau-title > div,\n.bau-eyebrow > div,\n.bau-optionLabel > div,\n.bau-description > div {\n  margin: 0;\n}\n\n.bau-optionLabel {\n  display: block;\n}\n\n.bau-description {\n  display: block;\n}\n\n.bau-card {\n  max-height: min(75vh, 640px);\n  max-height: min(75dvh, 640px);\n}\n\n.bau-frame {\n  padding-bottom: calc(10px + env(safe-area-inset-bottom));\n}\n\n@media (max-width: 720px) {\n  .bau-header {\n    flex-wrap: wrap;\n  }\n\n  .bau-headingBlock {\n    flex: 1 1 100%;\n  }\n\n  .bau-headerActions {\n    flex-wrap: wrap;\n    justify-content: flex-end;\n    margin-left: auto;\n  }\n\n  .bau-waitStatus {\n    white-space: normal;\n  }\n\n  .bau-card {\n    max-height: calc(100vh - 160px);\n    max-height: calc(100dvh - 160px);\n  }\n\n  .bau-title {\n    max-height: 24vh;\n    max-height: 24dvh;\n    font-size: 15px;\n    line-height: 21px;\n  }\n\n  .bau-footer {\n    flex-wrap: wrap;\n  }\n\n  .bau-feedback {\n    flex: 1 1 100%;\n    text-align: left;\n  }\n\n  .bau-footerActions {\n    width: 100%;\n    justify-content: flex-end;\n    flex-wrap: wrap;\n  }\n\n  .bau-option,\n  .bau-customRow {\n    min-height: 44px;\n  }\n}\n\n@media (max-width: 420px) {\n  .bau-footer {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .bau-pager {\n    justify-content: space-between;\n    width: 100%;\n  }\n\n  .bau-footerActions {\n    width: 100%;\n  }\n\n  .bau-footerActions > button {\n    flex: 1 1 auto;\n  }\n}\n";
var id3 = "dsh-better-ask-user/QuestionComposer.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(id3) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-better-ask-user";
  tag.dataset.pluginCss = id3;
  tag.textContent = css3;
  document.head.appendChild(tag);
}
var QuestionComposer_default = { "frame": "bau-frame", "card": "bau-card", "body": "bau-body", "css": "bau-css", "cardMinimized": "bau-cardMinimized", "header": "bau-header", "headerActions": "bau-headerActions", "waitButton": "bau-waitButton", "waitStatus": "bau-waitStatus", "headingBlock": "bau-headingBlock", "eyebrow": "bau-eyebrow", "title": "bau-title", "detail": "bau-detail", "footerActions": "bau-footerActions", "pager": "bau-pager", "progress": "bau-progress", "iconButton": "bau-iconButton", "options": "bau-options", "option": "bau-option", "number": "bau-number", "checkbox": "bau-checkbox", "optionSelected": "bau-optionSelected", "checkboxChecked": "bau-checkboxChecked", "optionCopy": "bau-optionCopy", "optionLine": "bau-optionLine", "optionLabel": "bau-optionLabel", "badge": "bau-badge", "description": "bau-description", "reviewNote": "bau-reviewNote", "customRow": "bau-customRow", "customRowYielded": "bau-customRowYielded", "customRowActive": "bau-customRowActive", "field": "bau-field", "fieldMirror": "bau-fieldMirror", "fieldInput": "bau-fieldInput", "customInline": "bau-customInline", "customBlock": "bau-customBlock", "footer": "bau-footer", "feedback": "bau-feedback" };

// src/client/QuestionComposer.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var REMOVED_CARD = {
  state: "open",
  waitState: "counting",
  countdown: void 0,
  channel: "none",
  closed: true
};
function parseRecommendedLabel(label) {
  const suffix = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i;
  return suffix.test(label) ? { label: label.replace(suffix, ""), recommended: true } : { label, recommended: false };
}
function recommendedFirstOption(question) {
  const label = question.options?.[0]?.label;
  return label !== void 0 && parseRecommendedLabel(label).recommended ? label : void 0;
}
function isQuestionDraftProgress(value, questionCount) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const progress = value;
  if (typeof progress.index !== "number" || !Number.isInteger(progress.index) || progress.index < 0 || progress.index >= questionCount || !Array.isArray(progress.drafts) || progress.drafts.length !== questionCount || progress.wait !== void 0 && progress.wait !== "editing" && progress.wait !== "waiting") return false;
  return progress.drafts.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const draft = item;
    return Array.isArray(draft.selected) && draft.selected.every((label) => typeof label === "string") && typeof draft.custom === "string" && typeof draft.skipped === "boolean";
  });
}
function isComposing(event) {
  return event.nativeEvent.isComposing || Reflect.get(event.nativeEvent, "keyCode") === 229;
}
function AnswerField(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: clsx_default(QuestionComposer_default.field, props.variant === "inline" ? QuestionComposer_default.customInline : QuestionComposer_default.customBlock), children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { "aria-hidden": true, className: QuestionComposer_default.fieldMirror, children: `${props.value}
` }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "textarea",
      {
        autoFocus: props.autoFocus,
        className: QuestionComposer_default.fieldInput,
        value: props.value,
        disabled: props.disabled,
        rows: 1,
        placeholder: props.placeholder,
        onFocus: props.onFocus,
        onChange: props.onChange,
        onKeyDown: props.onKeyDown
      }
    )
  ] });
}
function QuestionComposer(props) {
  const question = props.matched;
  const review = (0, import_react2.useMemo)(() => planReviewOf(question.questions), [question]);
  return review === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    QuestionFlow,
    {
      pending: question,
      t: props.t,
      useStore: props.useStore,
      useQuestionCard: props.useQuestionCard,
      actions: props.actions
    },
    question.key
  ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PlanReviewPanel, { pending: question, review, t: props.t, renderSlot: props.renderSlot }, question.key);
}
function QuestionFlow({ pending, t, useStore, useQuestionCard, actions }) {
  const questions = pending.questions;
  const review = pending.review;
  const markdownLabels = (0, import_react2.useMemo)(() => ({
    code: { copyLabel: t("copy"), copiedLabel: t("copied"), toolbarLabels: { codeLabel: t("codeBlock.title"), wrapLabel: t("codeBlock.wrap"), unwrapLabel: t("codeBlock.unwrap") } },
    footnotes: t("markdown.footnotes")
  }), [t]);
  const initialDrafts = (0, import_react2.useMemo)(() => {
    const recorded = new Map((review ?? []).map((answer) => [answer.id, answer]));
    return questions.map((item) => {
      const answer = recorded.get(item.id);
      const custom = answer?.custom ?? "";
      const recommended = review === void 0 ? recommendedFirstOption(item) : void 0;
      return {
        selected: answer === void 0 && recommended !== void 0 ? [recommended] : [...answer?.selected ?? []],
        custom,
        // A recorded answer with no selection and no custom text was skipped.
        skipped: answer !== void 0 && answer.selected.length === 0 && custom === ""
      };
    });
  }, [questions, review]);
  const stored = useStore((state) => state.progressByRequest[pending.key]);
  const validStored = isQuestionDraftProgress(stored, questions.length) ? stored : void 0;
  const storedProgress = review === void 0 ? validStored : void 0;
  const index = validStored?.index ?? 0;
  const drafts = storedProgress?.drafts ?? initialDrafts;
  const restoredWait = storedProgress?.wait ?? (storedProgress?.drafts.some((item, itemIndex) => item.selected.length !== initialDrafts[itemIndex]?.selected.length || item.selected.some((label, labelIndex) => label !== initialDrafts[itemIndex]?.selected[labelIndex]) || item.custom !== "" || item.skipped) === true ? "editing" : void 0);
  const [busy, setBusy] = (0, import_react2.useState)(null);
  const [error, setError] = (0, import_react2.useState)(null);
  const card = useQuestionCard(pending.key, (snapshot) => snapshot ?? REMOVED_CARD);
  const canSubmit = card.channel !== "none";
  const locked = busy !== null || review !== void 0;
  const sentVia = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    if (sentVia.current !== "waterfall" || card.state !== "continued") return;
    sentVia.current = null;
    setBusy(null);
    setError({ key: "error.resubmit" });
  }, [card.state]);
  (0, import_react2.useEffect)(() => {
    if (card.closed) actions.clear(pending.key);
  }, [actions, card.closed, pending.key]);
  (0, import_react2.useEffect)(() => {
    actions.prune(pending.liveKeys());
  }, [actions, pending]);
  const waitDisposition = (0, import_react2.useRef)(restoredWait);
  (0, import_react2.useEffect)(() => {
    if (waitDisposition.current === "waiting") pending.takeTime();
    if (waitDisposition.current === "editing") pending.bump();
  }, [pending]);
  const countdown = card.countdown;
  const [minimized, setMinimized] = (0, import_react2.useState)(false);
  const focusedQuestions = (0, import_react2.useRef)(/* @__PURE__ */ new Set());
  const answerSurface = (0, import_react2.useRef)(null);
  const question = questions[index];
  const draft = drafts[index];
  const hasOptions = (question.options?.length ?? 0) > 0;
  const replaceProgress = (nextIndex, nextDrafts) => {
    pending.bump();
    actions.replace(pending.key, {
      index: nextIndex,
      drafts: nextDrafts,
      ...waitDisposition.current === void 0 ? {} : { wait: waitDisposition.current }
    });
  };
  const takeTime = () => {
    waitDisposition.current = "waiting";
    pending.takeTime();
    replaceProgress(index, drafts);
  };
  const focusAnswerSurface = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.holdFocus();
  };
  const blurAnswerSurface = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) pending.releaseFocus();
  };
  (0, import_react2.useEffect)(() => {
    const release = () => {
      pending.releaseFocus();
    };
    const refocus = () => {
      if (answerSurface.current?.contains(document.activeElement) === true) pending.holdFocus();
    };
    const visibilityChanged = () => {
      if (document.hidden) release();
      else refocus();
    };
    window.addEventListener("blur", release);
    window.addEventListener("focus", refocus);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      release();
      window.removeEventListener("blur", release);
      window.removeEventListener("focus", refocus);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [pending]);
  const dismissFlow = () => {
    if (pending.dismissal === "hide") {
      void pending.dismiss();
      return;
    }
    if (!canSubmit) {
      setError({ key: "error.unavailable" });
      return;
    }
    setBusy("cancel");
    setError(null);
    sentVia.current = "waterfall";
    void pending.dismiss().catch((cause) => {
      sentVia.current = null;
      setBusy(null);
      setError({ text: cause instanceof Error ? cause.message : String(cause) });
    });
  };
  const updateDraft = (update, nextIndex = index) => {
    const nextDrafts = drafts.map((item, itemIndex) => itemIndex === index ? update(item) : item);
    replaceProgress(nextIndex, nextDrafts);
    setError(null);
  };
  const choose = (label) => {
    updateDraft((current) => {
      if (question.multiSelect === true) {
        const selected = current.selected.includes(label) ? current.selected.filter((item) => item !== label) : [...current.selected, label];
        return { ...current, selected, skipped: false };
      }
      return { selected: [label], custom: "", skipped: false };
    }, question.multiSelect !== true && index < questions.length - 1 ? index + 1 : index);
  };
  const answered = (item) => item.selected.length > 0 || item.custom.trim() !== "";
  const completed = (item) => answered(item) || item.skipped;
  const submitDrafts = (values) => {
    const missing = values.findIndex((item) => !completed(item));
    if (missing >= 0) {
      replaceProgress(missing, values);
      setError({ key: "error.incomplete" });
      return;
    }
    if (!canSubmit) {
      setError({ key: "error.unavailable" });
      return;
    }
    const answer = {
      answers: questions.map((item, itemIndex) => {
        const value = values[itemIndex];
        if (value.skipped) return { id: item.id, selected: [] };
        const custom = value.custom.trim();
        return {
          id: item.id,
          selected: custom === "" || item.multiSelect === true ? value.selected : [],
          ...custom === "" ? {} : { custom }
        };
      })
    };
    setBusy("answer");
    setError(null);
    const channel = pending.snapshot().channel;
    sentVia.current = channel === "waterfall" ? "waterfall" : null;
    void pending.answer(answer).then(() => {
      if (channel !== "rpc") return;
      sentVia.current = null;
      setBusy(null);
      setError(null);
      void pending.dismiss().catch(() => {
        setError({ key: "status.sent" });
      });
    }).catch((cause) => {
      sentVia.current = null;
      setBusy(null);
      setError({ text: cause instanceof Error ? cause.message : String(cause) });
    });
  };
  const continueFlow = () => {
    if (!answered(draft)) {
      setError({ key: "error.unanswered" });
      return;
    }
    if (index < questions.length - 1) {
      replaceProgress(index + 1, drafts);
      setError(null);
      return;
    }
    submitDrafts(drafts);
  };
  const draftCustom = (event) => {
    const value = event.target.value;
    updateDraft((current) => ({
      ...current,
      selected: question.multiSelect === true ? current.selected : [],
      custom: value,
      skipped: false
    }));
  };
  const continueFromCustom = (event) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing(event)) return;
    event.preventDefault();
    continueFlow();
  };
  const skipQuestion = () => {
    const nextDrafts = drafts.map((item, itemIndex) => itemIndex === index ? { selected: [], custom: "", skipped: true } : item);
    replaceProgress(index < questions.length - 1 ? index + 1 : index, nextDrafts);
    setError(null);
    if (index < questions.length - 1) {
      return;
    }
    submitDrafts(nextDrafts);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: QuestionComposer_default.frame, "data-question-key": pending.key, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "section",
    {
      className: clsx_default(QuestionComposer_default.card, minimized && QuestionComposer_default.cardMinimized),
      "aria-labelledby": `question-${pending.key}-${String(index)}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: QuestionComposer_default.header, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: QuestionComposer_default.headingBlock, children: [
            question.header !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: QuestionComposer_default.eyebrow, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.MarkdownText, { text: question.header, variant: "compact", labels: markdownLabels }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                className: QuestionComposer_default.title,
                id: `question-${pending.key}-${String(index)}`,
                role: "heading",
                "aria-level": 2,
                children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.MarkdownText, { text: question.question, variant: "compact", labels: markdownLabels })
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: QuestionComposer_default.headerActions, children: [
            countdown !== void 0 && card.waitState !== "waiting" && card.waitState !== "editing" && card.waitState !== "continued" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.waitStatus, children: t(countdown.running ? "wait.countdown" : "wait.paused", {
              seconds: Math.ceil(countdown.remainingMs / 1e3)
            }) }),
            countdown !== void 0 && card.waitState !== "waiting" && card.waitState !== "editing" && card.waitState !== "continued" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.waitStatus, children: t(card.timeoutMode === "default" ? "wait.auto" : "wait.extend") }),
            countdown !== void 0 && card.waitState !== "waiting" && card.waitState !== "editing" && card.waitState !== "continued" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", className: QuestionComposer_default.waitButton, onClick: takeTime, children: t("wait.takeTime") }),
            card.state === "continued" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.waitStatus, children: t("wait.continued") }),
            countdown !== void 0 && (card.waitState === "waiting" || card.waitState === "editing") && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.waitStatus, children: t("wait.held") }),
            review !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.waitStatus, children: t("review.status") }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: QuestionComposer_default.iconButton,
                "aria-label": t(minimized ? "nav.maximize" : "nav.minimize"),
                title: t(minimized ? "nav.maximize" : "nav.minimize"),
                "aria-expanded": !minimized,
                disabled: busy !== null,
                onClick: () => {
                  setMinimized((current) => !current);
                },
                children: minimized ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconChevronUpOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconChevronDownOutlineRegular, {})
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: QuestionComposer_default.iconButton,
                "aria-label": t(pending.dismissal === "hide" ? "nav.close" : "nav.cancel"),
                title: t(pending.dismissal === "hide" ? "nav.close" : "nav.cancel"),
                disabled: busy !== null,
                onClick: dismissFlow,
                children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconCloseOutlineRegular, {})
              }
            )
          ] })
        ] }),
        !minimized && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              ref: answerSurface,
              className: QuestionComposer_default.body,
              "data-question-scroll": true,
              onFocusCapture: focusAnswerSurface,
              onBlurCapture: blurAnswerSurface,
              children: [
                question.detail !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: QuestionComposer_default.detail, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.MarkdownText, { text: question.detail, labels: markdownLabels }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: QuestionComposer_default.options, role: question.multiSelect === true ? "group" : "radiogroup", children: [
                  (question.options ?? []).map((option, optionIndex) => {
                    const selected = draft.selected.includes(option.label);
                    const display = parseRecommendedLabel(option.label);
                    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                      "button",
                      {
                        type: "button",
                        className: clsx_default(QuestionComposer_default.option, selected && question.multiSelect !== true && QuestionComposer_default.optionSelected),
                        role: question.multiSelect === true ? "checkbox" : "radio",
                        "aria-checked": selected,
                        "aria-label": display.label,
                        disabled: locked,
                        onClick: () => {
                          choose(option.label);
                        },
                        onKeyDown: (event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          submitDrafts(drafts);
                        },
                        children: [
                          question.multiSelect === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: clsx_default(QuestionComposer_default.checkbox, selected && QuestionComposer_default.checkboxChecked), "aria-hidden": "true", children: selected && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconCheckOutlineRegular, { size: 12 }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.number, children: optionIndex + 1 }),
                          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.optionCopy, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: QuestionComposer_default.optionLine, children: [
                            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.optionLabel, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.MarkdownText, { text: display.label, variant: "compact", labels: markdownLabels }) }),
                            display.recommended && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.badge, children: t("option.recommended") }),
                            option.description !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.description, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.MarkdownText, { text: option.description, variant: "compact", labels: markdownLabels }) })
                          ] }) })
                        ]
                      },
                      `${option.label}-${String(optionIndex)}`
                    );
                  }),
                  review !== void 0 && draft.skipped && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: QuestionComposer_default.reviewNote, children: t("review.skipped") }),
                  (review === void 0 || draft.custom !== "") && (hasOptions ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                    "div",
                    {
                      className: clsx_default(
                        QuestionComposer_default.customRow,
                        draft.custom !== "" && QuestionComposer_default.customRowActive,
                        question.multiSelect !== true && draft.selected.length > 0 && QuestionComposer_default.customRowYielded
                      ),
                      children: [
                        question.multiSelect === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                          "span",
                          {
                            className: clsx_default(QuestionComposer_default.checkbox, draft.custom !== "" && QuestionComposer_default.checkboxChecked),
                            "aria-hidden": "true",
                            children: draft.custom !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconCheckOutlineRegular, { size: 12 })
                          }
                        ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: QuestionComposer_default.number, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconEditOutlineRegular, { size: 12 }) }),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                          AnswerField,
                          {
                            variant: "inline",
                            value: draft.custom,
                            disabled: locked,
                            placeholder: t("custom.placeholder"),
                            onChange: draftCustom,
                            onKeyDown: continueFromCustom
                          }
                        )
                      ]
                    }
                  ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    AnswerField,
                    {
                      autoFocus: canSubmit && countdown === void 0 && !locked && !focusedQuestions.current.has(index),
                      variant: "block",
                      value: draft.custom,
                      disabled: locked,
                      placeholder: t("custom.placeholder"),
                      onFocus: () => {
                        focusedQuestions.current.add(index);
                      },
                      onChange: draftCustom,
                      onKeyDown: continueFromCustom
                    }
                  ))
                ] })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("footer", { className: QuestionComposer_default.footer, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: QuestionComposer_default.pager, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: QuestionComposer_default.iconButton,
                  "aria-label": t("nav.prev"),
                  disabled: index === 0 || busy !== null,
                  onClick: () => {
                    replaceProgress(index - 1, drafts);
                    setError(null);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconChevronLeftOutlineRegular, {})
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: QuestionComposer_default.progress, children: [
                index + 1,
                " / ",
                questions.length
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: QuestionComposer_default.iconButton,
                  "aria-label": t("nav.next"),
                  disabled: index === questions.length - 1 || busy !== null,
                  onClick: () => {
                    replaceProgress(index + 1, drafts);
                    setError(null);
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconChevronRightOutlineRegular, {})
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: QuestionComposer_default.feedback, role: "status", children: error === null ? null : "key" in error ? t(error.key) : error.text }),
            review === void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: QuestionComposer_default.footerActions, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", disabled: busy !== null, onClick: skipQuestion, children: t("action.skip") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                import_dsh_client_ui_primitives3.Button,
                {
                  variant: "primary",
                  disabled: busy !== null || !answered(draft) || index === questions.length - 1 && !canSubmit,
                  onClick: continueFlow,
                  children: busy === "answer" ? t("submitting") : index === questions.length - 1 ? t("submit") : t("action.next")
                }
              )
            ] })
          ] })
        ] })
      ]
    }
  ) });
}

// ../../Library/Application Support/dsh-tauri/dependencies/dsh/node_modules/@deepseek-ai/dsh-session/lib/types/surface.js
var SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result"
]);
function isSurfaceEvent(event) {
  if (!SURFACE_EVENT_TYPES.has(event.type))
    return false;
  const candidate = event;
  return candidate.surfaceOp !== void 0;
}
function isAppendSurfaceEvent(event) {
  return isSurfaceEvent(event) && event.surfaceOp === "append";
}

// src/client/question-reply.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function replyPairsOf(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    void error;
    return { questions: [], answers: [] };
  }
  if (!isRecord2(value) || !Array.isArray(value.questions)) {
    return { questions: [], answers: [] };
  }
  const questions = [];
  for (const question of value.questions) {
    if (!isRecord2(question) || typeof question.id !== "string" || typeof question.question !== "string") continue;
    questions.push({
      id: question.id,
      question: question.question,
      ...typeof question.detail === "string" ? { detail: question.detail } : {},
      ...typeof question.header === "string" ? { header: question.header } : {},
      ...Array.isArray(question.options) ? { options: question.options.flatMap((option) => {
        if (!isRecord2(option) || typeof option.label !== "string") return [];
        return [{ label: option.label, ...typeof option.description === "string" ? { description: option.description } : {} }];
      }) } : {},
      ...typeof question.multiSelect === "boolean" ? { multiSelect: question.multiSelect } : {}
    });
  }
  const answers = [];
  for (const answer of Array.isArray(value.answers) ? value.answers : []) {
    if (!isRecord2(answer) || typeof answer.id !== "string" || !Array.isArray(answer.selected)) continue;
    answers.push({
      id: answer.id,
      selected: answer.selected.filter((item) => typeof item === "string"),
      ...typeof answer.custom === "string" ? { custom: answer.custom } : {}
    });
  }
  return { questions, answers };
}
function replyAnswerValues(data, id5) {
  const answer = data.answers.find((item) => item.id === id5);
  const custom = answer?.custom?.trim() ?? "";
  return [...answer?.selected ?? [], ...custom === "" ? [] : [custom]];
}
function replyClipboardText(data, t) {
  if (data.questions.length === 0) return data.text;
  return data.questions.map((question) => {
    const values = replyAnswerValues(data, question.id);
    const heading = question.header && question.header !== question.question ? `${question.header} \u2014 ${question.question}` : question.question;
    const answer = values.length === 0 ? t("reply.skipped") : `${t("reply.answerLabel")}${values.join(", ")}`;
    return `${heading}
${answer}`;
  }).join("\n\n");
}
function replySource(event) {
  const source = event.data.source;
  return isRecord2(source) && source.kind === "user-question-reply" && typeof source.callId === "string" && source.outcome === "answered" ? { callId: source.callId, outcome: "answered" } : null;
}
var questionReplyDefinition = {
  kind: "user-question-reply",
  target: "chat",
  match: (event) => {
    if (event.type !== "user/message" || !isAppendSurfaceEvent(event)) return null;
    return replySource(event) === null ? null : { id: String(event.data.id), role: "start", exclusive: true };
  },
  start: (_context, match) => {
    if (match.event.type !== "user/message") throw new Error("user-question-reply start requires user/message");
    const event = match.event;
    const block = event.data.content.find((item) => item.type === "text");
    const text = block?.text ?? "";
    const source = replySource(event);
    if (source === null) throw new Error("user-question-reply start requires a reply source");
    return {
      seq: event.seq,
      time: event.time,
      callId: source.callId,
      outcome: source.outcome,
      text,
      ...replyPairsOf(text)
    };
  },
  update: (context) => context.state,
  buildViewNode: (context) => {
    if (context.state === void 0) return null;
    const { seq, ...data } = context.state;
    return {
      key: context.key,
      kind: "question-reply",
      id: context.id,
      target: "chat",
      anchorSeq: seq,
      location: context.start?.location ?? { kind: "unresolved" },
      visibility: "visible",
      data
    };
  }
};

// src/client/QuestionReplyView.tsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/QuestionReplyView.module.css
var css4 = ".bau-row {\n  display: flex;\n  flex-direction: column;\n  justify-content: flex-end;\n  align-items: flex-end;\n  gap: 6px;\n  padding: 4px 0;\n}\n\n.bau-bubble {\n  max-width: 72%;\n  padding: 10px 16px;\n  border-radius: var(--dsw-radius-xl);\n  background: var(--dsw-specific-bubble);\n  color: var(--dsw-alias-label-primary);\n  cursor: pointer;\n  font-size: var(--dsh-content-font-size, 14px);\n  line-height: calc(22px + var(--dsh-content-font-delta, 0px));\n  text-align: left;\n  overflow-wrap: anywhere;\n  white-space: pre-wrap;\n}\n\n.bau-toggle {\n  width: 100%;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font: inherit;\n  text-align: left;\n}\n\n.bau-toggle:focus-visible {\n  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n  outline-offset: 2px;\n}\n\n.bau-bubble:has(.bau-toggle:focus-visible) {\n  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n}\n\n.bau-labelRow {\n  display: flex;\n  align-items: center;\n  gap: 3px;\n}\n\n.bau-caret {\n  display: inline-flex;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.bau-caret svg {\n  width: 12px;\n  height: 12px;\n}\n\n.bau-label {\n  color: var(--dsw-alias-label-secondary);\n  display: block;\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n  line-height: calc(18px + var(--dsh-content-font-delta-secondary, 0px));\n}\n\n.bau-summary {\n  display: block;\n  margin-top: 3px;\n  color: var(--dsw-alias-label-primary);\n  font-size: var(--dsh-content-font-size, 14px);\n}\n\n.bau-text {\n  margin: 8px 0 0;\n}\n\n.bau-details {\n  margin: 8px 0 0;\n  padding-top: 8px;\n  border-top: 1px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 24%, transparent);\n}\n\n.bau-details > div + div {\n  margin-top: 12px;\n}\n\n.bau-details dt {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.bau-question {\n  display: grid;\n  gap: 3px;\n}\n\n.bau-header,\n.bau-detail,\n.bau-options {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 11px;\n}\n\n.bau-questionText {\n  color: var(--dsw-alias-label-primary);\n}\n\n.bau-options {\n  margin: 0;\n  padding-left: 16px;\n}\n\n.bau-details dd {\n  margin: 4px 0 0;\n}\n\n.bau-answer {\n  font-size: 14px;\n}\n\n.bau-answerLabel {\n  margin-right: 4px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.bau-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  height: 28px;\n  padding-right: 4px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.bau-time {\n  padding-right: 4px;\n  font-size: 13px;\n  line-height: 24px;\n  white-space: nowrap;\n}\n\n.bau-action {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 28px;\n  height: 28px;\n  padding: 6px;\n  border: none;\n  border-radius: var(--dsw-radius-sm);\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n}\n\n.bau-action svg {\n  width: 15px;\n  height: 15px;\n}\n\n.bau-action:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* Better ask-user: long reply text and narrow screens. */\n.bau-row,\n.bau-summary,\n.bau-text,\n.bau-question,\n.bau-questionText,\n.bau-answer,\n.bau-details {\n  min-width: 0;\n  overflow-wrap: anywhere;\n  word-break: break-word;\n}\n\n@media (max-width: 720px) {\n  .bau-bubble {\n    max-width: 100%;\n  }\n\n  .bau-labelRow {\n    flex-wrap: wrap;\n  }\n\n  .bau-details {\n    max-width: 100%;\n  }\n}\n";
var id4 = "dsh-better-ask-user/QuestionReplyView.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(id4) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-better-ask-user";
  tag.dataset.pluginCss = id4;
  tag.textContent = css4;
  document.head.appendChild(tag);
}
var QuestionReplyView_default = { "row": "bau-row", "bubble": "bau-bubble", "toggle": "bau-toggle", "labelRow": "bau-labelRow", "caret": "bau-caret", "label": "bau-label", "summary": "bau-summary", "text": "bau-text", "details": "bau-details", "question": "bau-question", "header": "bau-header", "detail": "bau-detail", "options": "bau-options", "questionText": "bau-questionText", "answer": "bau-answer", "answerLabel": "bau-answerLabel", "actions": "bau-actions", "time": "bau-time", "action": "bau-action" };

// src/client/QuestionReplyView.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var QuestionReplyView = (0, import_react3.memo)(function QuestionReplyView2({ node, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(QuestionReplyBubble, { data: node.data, t });
});
function QuestionReplyBubble({ data, t }) {
  const label = t("reply.label");
  const [open, setOpen] = (0, import_react3.useState)(false);
  const toggleLabel = t(open ? "reply.close" : "reply.open");
  const summary = data.questions.map((question) => replyAnswerValues(data, question.id)).flat().join(", ");
  const copyText = replyClipboardText(data, t);
  const [copied, setCopied] = (0, import_react3.useState)(false);
  const onCopy = (0, import_react3.useCallback)(() => {
    if (copied) return;
    void (0, import_dsh_client_ui_primitives4.writeClipboard)(copyText).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1e3);
    });
  }, [copied, copyText]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: QuestionReplyView_default.row, "data-question-reply": data.callId, "data-reply-outcome": data.outcome, role: "group", "aria-label": label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: QuestionReplyView_default.bubble, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "button",
        {
          type: "button",
          className: QuestionReplyView_default.toggle,
          "aria-expanded": open,
          "aria-label": `${label} \xB7 ${toggleLabel}`,
          onClick: () => {
            setOpen((value) => !value);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: QuestionReplyView_default.labelRow, children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.caret, "aria-hidden": "true", children: open ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconChevronDownOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconChevronRightOutlineRegular, {}) }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.label, children: label })
            ] }),
            !open && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.summary, children: summary === "" ? t("reply.skipped") : summary })
          ]
        }
      ),
      open && (data.questions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: QuestionReplyView_default.text, children: data.text }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dl", { className: QuestionReplyView_default.details, children: data.questions.map((question) => {
        const values = replyAnswerValues(data, question.id);
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dt", { className: QuestionReplyView_default.question, children: [
            question.header && question.header !== question.question && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.header, children: question.header }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.questionText, children: question.question }),
            question.detail && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.detail, children: question.detail }),
            question.options && question.options.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: QuestionReplyView_default.options, children: question.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { children: [
              option.label,
              option.description && ` \u2014 ${option.description}`
            ] }, option.label)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dd", { className: QuestionReplyView_default.answer, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.answerLabel, children: t("reply.answerLabel") }),
            values.length === 0 ? t("reply.skipped") : values.join(", ")
          ] })
        ] }, question.id);
      }) }))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: QuestionReplyView_default.actions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: QuestionReplyView_default.time, children: new Intl.DateTimeFormat(void 0, { hour: "2-digit", minute: "2-digit", hour12: false }).format(data.time) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Tooltip, { label: copied ? t("copied") : t("copy"), side: "bottom", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: QuestionReplyView_default.action, "aria-label": copied ? t("copied") : t("copy"), onClick: onCopy, children: copied ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconCheckOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconCopyOutlineRegular, {}) }) })
    ] })
  ] });
}

// src/client/locales.ts
var zh = {
  "error.incomplete": "\u8BF7\u5148\u5B8C\u6210\u8FD9\u9053\u95EE\u9898\u3002",
  "error.unanswered": "\u8BF7\u9009\u62E9\u4E00\u4E2A\u9009\u9879\u6216\u586B\u5199\u81EA\u5B9A\u4E49\u7B54\u6848\u3002",
  "error.unavailable": "\u5F53\u524D\u65E0\u6CD5\u63D0\u4EA4\uFF0C\u8BF7\u7A0D\u5019\u518D\u8BD5\u3002",
  "error.resubmit": "\u56DE\u7B54\u672A\u9001\u8FBE\uFF0C\u5DE5\u4F5C\u5DF2\u7EE7\u7EED\uFF0C\u8BF7\u518D\u63D0\u4EA4\u4E00\u6B21\u3002",
  "status.sent": "\u56DE\u7B54\u5DF2\u53D1\u9001\uFF1B\u9762\u677F\u672A\u80FD\u5173\u95ED\u3002",
  "history.title": "\u95EE\u9898",
  "history.review": "\u67E5\u770B",
  "history.reopen": "\u6253\u5F00",
  "wait.takeTime": "\u6162\u6162\u56DE\u7B54",
  "wait.countdown": "{seconds} \u79D2\u540E\u7EE7\u7EED\u5DE5\u4F5C",
  "wait.paused": "\u5DF2\u6682\u505C \xB7 \u5269\u4F59 {seconds} \u79D2",
  "wait.held": "\u4F1A\u4E00\u76F4\u7B49\u4F60\u56DE\u7B54",
  "wait.extend": "\u8F93\u5165\u4F1A\u81EA\u52A8\u7EED\u671F",
  "wait.auto": "\u5230\u70B9\u5C06\u81EA\u52A8\u9009\u62E9\u9ED8\u8BA4\u9879",
  "wait.continued": "\u5DF2\u7EE7\u7EED\u5DE5\u4F5C\uFF0C\u4ECD\u53EF\u56DE\u7B54",
  "review.status": "\u5DF2\u56DE\u7B54",
  "review.skipped": "\u8FD9\u9053\u95EE\u9898\u5F53\u65F6\u88AB\u8DF3\u8FC7\u3002",
  "reply.label": "\u56DE\u7B54\u5148\u524D\u7B49\u5F85\u4E2D\u7684\u95EE\u9898",
  "reply.open": "\u5C55\u5F00\u95EE\u9898\u8BE6\u60C5",
  "reply.close": "\u6536\u8D77\u95EE\u9898\u8BE6\u60C5",
  "reply.answerLabel": "\u56DE\u7B54\uFF1A",
  "reply.skipped": "\u5DF2\u8DF3\u8FC7",
  "nav.prev": "\u4E0A\u4E00\u9898",
  "nav.next": "\u4E0B\u4E00\u9898",
  "nav.minimize": "\u6536\u8D77\u95EE\u9898\u5361\u7247",
  "nav.maximize": "\u5C55\u5F00\u95EE\u9898\u5361\u7247",
  "nav.cancel": "\u653E\u5F03\u6574\u7EC4\u95EE\u9898",
  "nav.close": "\u6536\u8D77\u95EE\u9898\u9762\u677F\uFF0C\u53EF\u4ECE\u5DE5\u5177\u8C03\u7528\u91CD\u65B0\u6253\u5F00",
  "option.recommended": "\u63A8\u8350",
  "custom.placeholder": "\u8F93\u5165\u4F60\u7684\u7B54\u6848",
  "action.skip": "\u8DF3\u8FC7",
  "action.next": "\u4E0B\u4E00\u9898",
  "plan.header": "\u8BA1\u5212\u5F85\u5BA1",
  "plan.approve": "\u540C\u610F\u6267\u884C",
  "plan.decline": "\u62D2\u7EDD",
  "plan.discuss": "\u8981\u6C42\u4FEE\u6539"
};
var en = {
  "error.incomplete": "Please complete this question first.",
  "error.unanswered": "Please select an option or enter a custom answer.",
  "error.unavailable": "Cannot submit right now; try again in a moment.",
  "error.resubmit": "The answer did not arrive before work continued; submit it again.",
  "status.sent": "Reply sent; the panel could not close.",
  "history.title": "Question",
  "history.review": "Review",
  "history.reopen": "Open",
  "wait.takeTime": "Take time",
  "wait.countdown": "Continuing in {seconds}s",
  "wait.paused": "Paused \xB7 {seconds}s remaining",
  "wait.held": "Waiting until you answer",
  "wait.extend": "Typing extends the wait",
  "wait.auto": "Auto-selects defaults at timeout",
  "wait.continued": "Work continued \u2014 you can still answer",
  "review.status": "Answered",
  "review.skipped": "This question was skipped.",
  "reply.label": "Reply to earlier pending questions",
  "reply.open": "Open question details",
  "reply.close": "Close question details",
  "reply.answerLabel": "Answer: ",
  "reply.skipped": "Skipped",
  "nav.prev": "Previous question",
  "nav.next": "Next question",
  "nav.minimize": "Collapse the question card",
  "nav.maximize": "Expand the question card",
  "nav.cancel": "Dismiss all questions",
  "nav.close": "Close the panel \u2014 reopen it from the tool call",
  "option.recommended": "Recommended",
  "custom.placeholder": "Type your answer",
  "action.skip": "Skip",
  "action.next": "Next",
  "plan.header": "Plan review",
  "plan.approve": "Approve",
  "plan.decline": "Refuse",
  "plan.discuss": "Request changes"
};

// src/client/settings.tsx
var import_react4 = require("react");

// src/client/settings-locales.ts
var settingsZh = {
  summary: "\u63D0\u95EE\u7B49\u5F85\u3001\u8F93\u5165\u7EED\u671F\u4E0E\u8D85\u65F6\u884C\u4E3A",
  title: "\u63D0\u95EE\u8BBE\u7F6E",
  intro: "\u63A7\u5236 ask_user_question \u7684\u7B49\u5F85\u65F6\u957F\u3001\u8F93\u5165\u7EED\u671F\u548C\u8D85\u65F6\u884C\u4E3A\uFF1B\u4FEE\u6539\u540E\u5BF9\u4E4B\u540E\u5F00\u59CB\u7684\u63D0\u95EE\u751F\u6548\u3002",
  waitLabel: "\u7B49\u5F85\u65F6\u957F\uFF08\u79D2\uFF09",
  waitHint: "-1 \u8868\u793A\u4E0D\u8D85\u65F6\uFF1B\u5176\u4ED6\u503C\u4E3A 1 \u5230 2147483\u3002\u5361\u7247\u5185\u6BCF\u6B21\u771F\u5B9E\u8F93\u5165\u90FD\u4F1A\u4ECE\u8BE5\u65F6\u957F\u91CD\u65B0\u8BA1\u65F6\u3002",
  behaviorLabel: "\u666E\u901A\u4F1A\u8BDD\u8D85\u65F6\u884C\u4E3A",
  goalBehaviorLabel: "Goal \u6D3B\u8DC3\u65F6\u7684\u8D85\u65F6\u884C\u4E3A",
  native: "\u539F\u751F pending",
  default: "\u8D85\u65F6\u540E\u9ED8\u8BA4\u9009\u62E9",
  nativeHint: "\u5230\u70B9\u540E\u8FD4\u56DE\u5B98\u65B9\u7684 pending \u7ED3\u679C\uFF0C\u7528\u6237\u4ECD\u53EF\u7A0D\u540E\u56DE\u7B54\u3002",
  defaultHint: "\u5230\u70B9\u540E\u6309\u89C4\u5219\u9009\u62E9\u9ED8\u8BA4\u9879\uFF0C\u5E76\u660E\u786E\u6807\u8BB0\u4E3A\u81EA\u52A8\u9009\u62E9\u800C\u975E\u7528\u6237\u56DE\u7B54\u3002",
  readonly: "\u5F53\u524D\u914D\u7F6E\u4E3A\u53EA\u8BFB\u3002",
  loading: "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026",
  unavailable: "\u5F53\u524D\u8FDE\u63A5\u4E0B\u8BE5\u914D\u7F6E\u4E0D\u53EF\u7528\u3002",
  waiting: "\u6B63\u5728\u7B49\u5F85\u5BBF\u4E3B\u63D0\u4F9B\u8FD9\u4E00\u884C\u7684\u914D\u7F6E\u2026",
  invalidWait: "\u7B49\u5F85\u65F6\u957F\u5FC5\u987B\u662F -1 \u6216 1 \u5230 2147483 \u7684\u6574\u6570\u3002",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u3002",
  conflict: "\u8BBE\u7F6E\u5DF2\u88AB\u5176\u4ED6\u7A97\u53E3\u4FEE\u6539\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A",
  dirty: "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539"
};
var settingsEn = {
  summary: "Question wait, input extension and timeout behavior",
  title: "Question settings",
  intro: "Controls the wait, input extension and timeout behavior for ask_user_question. Changes apply to questions started afterwards.",
  waitLabel: "Wait duration (seconds)",
  waitHint: "-1 never times out; otherwise 1 to 2147483. Every real input in the card restarts this window.",
  behaviorLabel: "Inactive-session timeout behavior",
  goalBehaviorLabel: "Goal-active timeout behavior",
  native: "Native pending",
  default: "Default selection at timeout",
  nativeHint: "Return the official pending result; the user can still answer later.",
  defaultHint: "Select defaults by rule at timeout and mark the result as auto-selected, not a user answer.",
  readonly: "This configuration is read-only.",
  loading: "Loading settings\u2026",
  unavailable: "This configuration is unavailable on the current connection.",
  waiting: "Waiting for the host configuration snapshot\u2026",
  invalidWait: "The wait must be -1 or an integer from 1 to 2147483.",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved.",
  conflict: "The settings changed in another window; try again.",
  saveFailed: "Save failed: ",
  dirty: "Unsaved changes"
};

// src/client/settings.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var DEFAULTS = { questionTimeoutSeconds: 120, timeoutBehavior: "native", goalTimeoutBehavior: "native" };
var MAX_QUESTION_TIMEOUT_SECONDS = 2147483;
var fallbackT = (key) => settingsEn[key];
function normalize(value) {
  const seconds = value?.questionTimeoutSeconds;
  return {
    questionTimeoutSeconds: seconds === -1 || Number.isInteger(seconds) && seconds >= 1 && seconds <= MAX_QUESTION_TIMEOUT_SECONDS ? seconds : DEFAULTS.questionTimeoutSeconds,
    timeoutBehavior: value?.timeoutBehavior === "default" ? "default" : "native",
    goalTimeoutBehavior: value?.goalTimeoutBehavior === "default" ? "default" : "native"
  };
}
function toDraft(value) {
  return {
    questionTimeoutSeconds: String(value.questionTimeoutSeconds),
    timeoutBehavior: value.timeoutBehavior,
    goalTimeoutBehavior: value.goalTimeoutBehavior
  };
}
function parseSeconds(text) {
  const trimmed = text.trim();
  if (trimmed === "-1") return -1;
  if (!/^[0-9]+$/.test(trimmed)) return void 0;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_QUESTION_TIMEOUT_SECONDS ? value : void 0;
}
function same(left, right) {
  return left.questionTimeoutSeconds === right.questionTimeoutSeconds && left.timeoutBehavior === right.timeoutBehavior && left.goalTimeoutBehavior === right.goalTimeoutBehavior;
}
function parseDraft(draft) {
  const seconds = parseSeconds(draft.questionTimeoutSeconds);
  if (seconds === void 0) return void 0;
  return { questionTimeoutSeconds: seconds, timeoutBehavior: draft.timeoutBehavior, goalTimeoutBehavior: draft.goalTimeoutBehavior };
}
var fieldStyle = { display: "grid", gap: 6, marginBottom: 18 };
var labelStyle = { fontWeight: 600, fontSize: 13 };
var hintStyle = { margin: 0, fontSize: 12, opacity: 0.65, lineHeight: 1.45 };
var inputStyle = { maxWidth: 320, padding: "7px 9px", borderRadius: 8, border: "1px solid rgba(127,127,127,.35)", background: "transparent", color: "inherit", font: "inherit" };
var statusStyle = { fontSize: 12, lineHeight: 1.5 };
function SettingsPage({ form, t = fallbackT }) {
  const state = form?.state;
  const revision = state?.revision;
  const host = state?.status === "ready" ? normalize(state.value) : null;
  const base = host === null ? null : toDraft(host);
  const [draft, setDraft] = (0, import_react4.useState)(null);
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [notice, setNotice] = (0, import_react4.useState)(null);
  const live = draft !== null && draft.revision === revision ? draft.value : base;
  const parsed = live === null ? void 0 : parseDraft(live);
  const writable = state?.status === "ready" && state?.writable === true;
  const dirty = host !== null && parsed !== void 0 && !same(host, parsed);
  const edit = (0, import_react4.useCallback)((mutate) => {
    setNotice(null);
    if (base === null) return;
    setDraft((previous) => {
      const current = previous !== null && previous.revision === revision ? previous.value : base;
      return { revision: revision ?? 0, value: mutate(current) };
    });
  }, [base, revision]);
  const save = (0, import_react4.useCallback)(async () => {
    if (form === void 0 || host === null || parsed === void 0) return;
    if (!writable || busy || !dirty) return;
    const ops = [];
    if (host.questionTimeoutSeconds !== parsed.questionTimeoutSeconds) {
      ops.push({ op: "set", path: ["questionTimeoutSeconds"], value: parsed.questionTimeoutSeconds });
    }
    if (host.timeoutBehavior !== parsed.timeoutBehavior) {
      ops.push({ op: "set", path: ["timeoutBehavior"], value: parsed.timeoutBehavior });
    }
    if (host.goalTimeoutBehavior !== parsed.goalTimeoutBehavior) {
      ops.push({ op: "set", path: ["goalTimeoutBehavior"], value: parsed.goalTimeoutBehavior });
    }
    if (ops.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const accepted = await form.mutate(ops, revision);
      if (accepted) setNotice({ tone: "ok", text: t("saved") });
      else {
        setDraft(null);
        setNotice({ tone: "error", text: t("conflict") });
      }
    } catch (error) {
      setNotice({ tone: "error", text: t("saveFailed") + String(error?.message ?? error) });
    } finally {
      setBusy(false);
    }
  }, [busy, dirty, form, host, parsed, revision, t, writable]);
  if (state === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: statusStyle, children: t("waiting") }) });
  }
  if (state.status === "loading") {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: statusStyle, children: t("loading") }) });
  }
  if (host === null || live === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { padding: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: statusStyle, children: t("unavailable") }) });
  }
  const invalid = parsed === void 0;
  const status = notice !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { ...statusStyle, color: notice.tone === "ok" ? "#2f8f4e" : "#c0392b" }, children: notice.text }) : invalid ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { ...statusStyle, color: "#c0392b" }, children: t("invalidWait") }) : dirty ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: statusStyle, children: t("dirty") }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { padding: "4px 2px", maxWidth: 720 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { style: { margin: "0 0 6px", fontSize: 16 }, children: t("title") }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { ...hintStyle, marginBottom: 18 }, children: t("intro") }),
    writable ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: { ...statusStyle, marginBottom: 14 }, children: t("readonly") }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: fieldStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: labelStyle, htmlFor: "better-ask-user-wait", children: t("waitLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          id: "better-ask-user-wait",
          type: "number",
          min: -1,
          max: MAX_QUESTION_TIMEOUT_SECONDS,
          step: 1,
          style: inputStyle,
          value: live.questionTimeoutSeconds,
          disabled: !writable || busy,
          onChange: (event) => {
            const next = event.target.value;
            edit((current) => ({ ...current, questionTimeoutSeconds: next }));
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: hintStyle, children: t("waitHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: fieldStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: labelStyle, htmlFor: "better-ask-user-behavior", children: t("behaviorLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "select",
        {
          id: "better-ask-user-behavior",
          style: inputStyle,
          value: live.timeoutBehavior,
          disabled: !writable || busy,
          onChange: (event) => {
            const next = event.target.value === "default" ? "default" : "native";
            edit((current) => ({ ...current, timeoutBehavior: next }));
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "native", children: t("native") }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "default", children: t("default") })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: hintStyle, children: t(live.timeoutBehavior === "default" ? "defaultHint" : "nativeHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: fieldStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { style: labelStyle, htmlFor: "better-ask-user-goal-behavior", children: t("goalBehaviorLabel") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "select",
        {
          id: "better-ask-user-goal-behavior",
          style: inputStyle,
          value: live.goalTimeoutBehavior,
          disabled: !writable || busy,
          onChange: (event) => {
            const next = event.target.value === "default" ? "default" : "native";
            edit((current) => ({ ...current, goalTimeoutBehavior: next }));
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "native", children: t("native") }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "default", children: t("default") })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { style: hintStyle, children: t(live.goalTimeoutBehavior === "default" ? "defaultHint" : "nativeHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          disabled: !writable || busy || !dirty || invalid,
          onClick: () => {
            void save();
          },
          style: { padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(127,127,127,.35)", background: "rgba(127,127,127,.12)", color: "inherit", font: "inherit", cursor: "pointer" },
          children: busy ? t("saving") : t("save")
        }
      ),
      status
    ] })
  ] });
}
function SettingsEntry(props) {
  const t = props.t ?? fallbackT;
  if (props.view === "summary") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("summary") });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SettingsPage, { form: props.form, t });
}

// src/client/index.ts
var NS = "question";
var inject = ["sessions", "remote", "remote.userQuestions", "uiSession", "slots", "locale", "uiConversation"];
var QuestionCards = class {
  constructor(publish) {
    this.publish = publish;
  }
  #cards = /* @__PURE__ */ new Map();
  byCallId(sessionId, callId) {
    return this.#cards.get(PendingQuestion.keyOf(sessionId, callId));
  }
  /** Observable state for one card while the registry owns it. */
  source(key) {
    return this.#cards.get(key)?.pending;
  }
  values() {
    return [...this.#cards.values()];
  }
  /** Keys of every card registered for one Session. */
  keysFor(sessionId) {
    return this.values().filter((card) => card.pending.sessionId === sessionId).map((card) => card.pending.key);
  }
  /**
   * Return the card of a tool call, creating and publishing it when absent.
   * A request without a call id always gets a fresh card.
   */
  ensure(sessionId, questions, callId, settings) {
    if (callId !== void 0) {
      const existing = this.byCallId(sessionId, callId);
      if (existing !== void 0) return existing;
    }
    return this.#create(new PendingQuestion(sessionId, questions, callId, () => this.keysFor(sessionId), void 0, settings));
  }
  /** Publish one carrier into the composer seat and register the card that owns it. */
  #create(pending) {
    const requests = /* @__PURE__ */ new Set();
    const delegate = async () => {
      pending.delegate();
      await Promise.all(requests);
    };
    let unpublish = this.publish(pending, delegate);
    const card = {
      pending,
      hide: () => {
        unpublish?.();
        unpublish = void 0;
      },
      reveal: () => {
        unpublish?.();
        unpublish = this.publish(pending, delegate);
      },
      remove: () => {
        if (this.#cards.get(pending.key) !== card) return;
        this.#cards.delete(pending.key);
        pending.close();
        unpublish?.();
        unpublish = void 0;
      },
      trackRequest: (completion) => {
        requests.add(completion);
        return () => {
          requests.delete(completion);
        };
      },
      hasRequest: () => requests.size > 0
    };
    pending.attachSeat({ hide: pending.review === void 0 ? card.hide : card.remove });
    this.#cards.set(pending.key, card);
    return card;
  }
  /**
   * Show the panel of one answerable tool call.
   * @param sessionId - Session the tool call belongs to.
   * @param callId - `ask_user_question` call whose panel to show, as its
   * transcript row spells it.
   * @returns whether a card for that call is still answerable.
   */
  reveal(sessionId, callId) {
    const card = this.byCallId(sessionId, callId);
    if (card === void 0) return false;
    card.reveal();
    return true;
  }
  /**
   * Show one settled tool call's recorded answers as a read-only card. A call
   * that somehow still holds a card is shown as it stands, so a live request is
   * never replaced by a stale copy of itself.
   * @param sessionId - Session the tool call belongs to.
   * @param callId - `ask_user_question` call whose record to show, as its
   * transcript row spells it.
   * @param record - the call's questions and recorded answers.
   * @returns true; a record always produces a card.
   */
  review(sessionId, callId, record) {
    const card = this.byCallId(sessionId, callId) ?? this.#create(new PendingQuestion(
      sessionId,
      record.questions,
      brandString(callId),
      () => this.keysFor(sessionId),
      record.answers
    ));
    card.reveal();
    return true;
  }
  /**
   * Hand every live waterfall back at plugin teardown. The pending-interaction
   * registry only drains what it currently holds, and a hidden card is not in
   * it, so its Host request would wait for its own abort instead.
   */
  dispose() {
    for (const card of this.values()) {
      card.pending.delegate();
      card.remove();
    }
  }
};
async function answerQuestion(ctx, owner, request, next, cards) {
  const sessionId = ctx.sessions.scopeOf(owner);
  if (sessionId === void 0) return next();
  const callId = request.wait?.callId;
  const better = request.better;
  const card = cards.ensure(sessionId, request.questions, callId, better);
  const claimLifetime = new AbortController();
  const claimSignal = request.signal === void 0 ? claimLifetime.signal : AbortSignal.any([claimLifetime.signal, request.signal]);
  let claim;
  let claimEnded;
  let delegateRequest;
  const releaseClaim = request.wait?.timed === true && callId !== void 0 ? ctx.effect(() => {
    claim = ctx.remote.userQuestions.attachWait(sessionId, callId, claimSignal);
    return async () => {
      delegateRequest?.();
      claimLifetime.abort();
      claim?.dispose();
      if (claimEnded !== void 0) await Promise.allSettled([claimEnded]);
    };
  }, "ui-user-questions: foreground claim") : void 0;
  const completed = Promise.withResolvers();
  const finishRequest = card.trackRequest(completed.promise);
  try {
    const iterator = claim?.[Symbol.asyncIterator]();
    const opening = iterator === void 0 ? void 0 : await iterator.next();
    if (opening?.done === true) return await next();
    const waterfall = createWaterfallRequest(
      opening === void 0 ? void 0 : Date.now() + opening.value.remainingMs,
      claimSignal,
      (channel) => {
        card.pending.detachWaterfall(channel);
      }
    );
    if (claimSignal.aborted) return await waterfall.result;
    delegateRequest = () => {
      waterfall.channel.delegate();
    };
    card.pending.attachWaterfall(waterfall.channel);
    if (iterator !== void 0) {
      claimEnded = (async () => {
        await iterator.next();
        throw new Error("the foreground question wait ended");
      })();
    }
    try {
      return await (claimEnded === void 0 ? waterfall.result : Promise.race([waterfall.result, claimEnded]));
    } catch (error) {
      if (waterfall.isDelegation(error)) {
        await releaseClaim?.();
        return await next();
      }
      throw error;
    }
  } finally {
    if (releaseClaim === void 0) claimLifetime.abort();
    else if (claimEnded === void 0) await releaseClaim();
    else {
      void Promise.allSettled([claimEnded]).then(() => {
        void releaseClaim();
      });
    }
    if (callId === void 0) card.remove();
    completed.resolve();
    finishRequest();
  }
}
function publishContinuedQuestions(ctx, cards) {
  const sessions = ctx.sessions;
  const stopProjections = /* @__PURE__ */ new Map();
  const unwrap = (result) => {
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const rpcFor = (sessionId, callId) => ({
    answer: async (answer) => unwrap(await ctx.remote.userQuestions.answer(sessionId, callId, answer))
  });
  const reconcile = () => {
    const snapshot = sessions.list.getSnapshot();
    const bound = new Map(Object.values(snapshot.byId).flatMap((summary) => {
      const binding = sessions.binding(summary.id);
      return binding === void 0 ? [] : [[summary.id, binding]];
    }));
    for (const [sessionId, stop] of stopProjections) {
      if (bound.has(sessionId)) continue;
      stop();
      stopProjections.delete(sessionId);
    }
    for (const [sessionId, binding] of bound) {
      if (stopProjections.has(sessionId)) continue;
      const stopQuestions = binding.session.projections.faceOf("userQuestions").subscribe(reconcile);
      const stopInbox = binding.session.projections.faceOf("inbox").subscribe(reconcile);
      stopProjections.set(sessionId, () => {
        stopQuestions();
        stopInbox();
      });
    }
    const rows = /* @__PURE__ */ new Map();
    for (const [sessionId, binding] of bound) {
      const projected = binding.session.projections.faceOf("userQuestions").getSnapshot();
      const inbox = binding.session.projections.faceOf("inbox").getSnapshot();
      const queued = /* @__PURE__ */ new Set();
      for (const message of [...inbox?.["next-step"] ?? [], ...inbox?.["next-turn"] ?? []]) {
        if (typeof message !== "object" || message === null || Array.isArray(message)) continue;
        const source = message.source;
        if (typeof source !== "object" || source === null || Array.isArray(source)) continue;
        if (source.kind === "user-question-reply" && typeof source.callId === "string") queued.add(source.callId);
      }
      for (const row of projected?.active ?? []) {
        if (row.state === "continued" && queued.has(row.callId)) continue;
        rows.set(PendingQuestion.keyOf(sessionId, row.callId), { sessionId, row });
      }
    }
    for (const { sessionId, row } of rows.values()) {
      if (row.state === "continued") {
        const card = cards.ensure(sessionId, row.questions, row.callId);
        card.pending.attachRpc(rpcFor(sessionId, row.callId));
        card.pending.setState("continued");
        continue;
      }
      cards.byCallId(sessionId, row.callId)?.pending.setState("open");
    }
    for (const card of cards.values()) {
      if (card.pending.callId === void 0 || card.pending.review !== void 0 || rows.has(card.pending.key) || card.hasRequest() || card.pending.hasWaterfall()) continue;
      card.remove();
    }
  };
  reconcile();
  const stopList = sessions.list.subscribe(reconcile);
  return () => {
    stopList();
    for (const stop of stopProjections.values()) stop();
    stopProjections.clear();
  };
}
var SETTINGS_NS = "better-ask-user-settings";
var ROW_CONFIG_KEYS = Object.freeze([
  "dsh-better-ask-user#dsh-better-ask-user",
  "@menghuan1918/dsh-apollo#dsh-better-ask-user",
  "dsh-apollo#dsh-better-ask-user"
]);
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-user-questions: dictionaries");
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh: settingsZh, en: settingsEn }), "better-ask-user: settings dictionaries");
  ctx.effect(() => ctx.slots.inject("plugins.row.config", () => {
    const disposers = [];
    for (const key of ROW_CONFIG_KEYS) {
      try {
        const dispose = ctx.slots.register({
          name: "plugins.row.config",
          key,
          locale: SETTINGS_NS
        }, SettingsEntry);
        if (typeof dispose === "function") disposers.push(dispose);
      } catch {
      }
    }
    return () => {
      for (const dispose of disposers) dispose();
    };
  }), "better-ask-user: row config page");
  const questionDraftStore = createQuestionDraftStore();
  const registerPendingInteraction = ctx.uiSession.registerPendingInteraction(
    (pending) => pending.kind === "plan-review" ? 2 : 1
  );
  const cards = new QuestionCards(registerPendingInteraction);
  ctx.effect(() => () => {
    cards.dispose();
  }, "ui-user-questions: cards");
  const disposePanels = ctx.reflect.provide("userQuestionPanels", {
    reveal: (sessionId, callId) => cards.reveal(sessionId, callId),
    review: (sessionId, callId, record) => cards.review(sessionId, callId, record)
  });
  ctx.effect(() => disposePanels, "ui-user-questions: answer panels");
  ctx.effect(() => publishContinuedQuestions(ctx, cards), "ui-user-questions: continued questions");
  ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
    name: "tool.call.toolview",
    key: "ask_user_question",
    locale: NS,
    inject: (sessionId) => ({
      revealPanel: (callId) => ctx.get("userQuestionPanels")?.reveal(sessionId, callId) ?? false,
      reviewPanel: (callId, record) => ctx.get("userQuestionPanels")?.review(sessionId, callId, record) ?? false
    })
  }, AskHistoryRow));
  ctx.slots.inject("conversation.composer", () => ctx.slots.register(
    {
      name: "conversation.composer",
      select: ({ pendingInteraction }) => pendingInteraction instanceof PendingQuestion ? pendingInteraction : null,
      locale: NS,
      store: questionDraftStore,
      inject: () => ({ keyedHooks: { questionCard: (key) => cards.source(key) } }),
      children: { "conversation.plan-review.actions": { kind: "list", scope: "session" } }
    },
    QuestionComposer
  ));
  ctx.uiConversation.events.register(questionReplyDefinition);
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "question-reply",
    locale: NS
  }, QuestionReplyView));
  ctx.remote.$on("user-questions/request", function(request, next) {
    return answerQuestion(ctx, this, request, next, cards);
  });
}

    return module.exports;
  }
});
