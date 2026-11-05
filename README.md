# dsh-better-ask-user

For DeepSeek Harness 0.2.2-rc.1 only (Node >=24.9.0). It keeps the official
question/answer protocol and replaces the Web card with one that supports:

- a configurable wait in seconds, including -1 for no timeout;
- extending the wait on every real user input in the card;
- sanitized markdown for question/header/detail/option/reply text;
- narrow-screen, safe-area and long-text layout;
- native pending behavior or automatic default selection after the wait;
- separate timeout behavior for goal-active and inactive sessions;
- the shared PTC deadline exemption for ask_user_question.

The base tool-ask-user row remains in the preset; this plugin registers an
agent-scoped shadow so the model-facing tool name stays ask_user_question.
The official Web card row (ui-user-questions) is disabled by this bundle; the
client half in this package renders the replacement card.

## Row settings

- questionTimeoutSeconds: default 120; -1 never times out; 1..2147483.
- timeoutBehavior: native (default) or default.
- goalTimeoutBehavior: native (default) or default.

Changes are volatile and affect newly started questions. The active wait is
owned by the client card's claim; input resets its countdown to the configured
wait. When the countdown expires, native returns the official pending result;
default answers with the host-provided default batch and marks it autoSelected.

The schema includes the official `timeout` continuation marker so next can
replay pending questions and accept late replies. It is not a per-call timing
override: omit it; the row setting above owns the foreground duration.

## Default selection

Single-select picks the first option. Multi-select picks every option whose
label ends with (Recommended) or (推荐); if none is recommended it picks the
first option. A question with no options is skipped with selected: []. An
auto-selected result is never presented as a user answer; the model-facing
render includes an explicit warning.

## Install

The package is a DSH bundle. Install it with dsh plugin add; its bundle patch
inserts the stable dsh-better-ptc row and disables the official Web card.

## Development

~~~sh
npm install
npm test
npm run build
~~~

Unit tests use boundary fakes for userQuestions/goals; source-compiled client
tests exercise the real card and waterfall. The optional installed-host suite
uses actual DSH tool resolution, prompt assembly, execution, Gateway event
frames, and plan review. Run it against the exact host installation:

~~~sh
DSH_PACKAGE_ROOT=/path/to/node_modules/@deepseek-ai/dsh npm test
~~~

The Gateway test uses the real in-process wire carrier with JSON serialization,
not a browser or WebSocket end-to-end test. Plan review and permission intents
never use the ordinary question countdown or automatic defaults; they remain
open until an explicit decision or cancellation. The PTC service owns the
exit_plan_mode elapsed-time exemption.

The client half builds into the DSH client closure format. The release lockfile
resolves the exact dsh-better-ptc 0.2.0 dependency from the official npm registry;
local tarballs were used only before the dependency was published.
