# dsh-better-ask-user

Independent DeepSeek Harness ask_user_question plugin. It keeps the official
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

The host tests use fake userQuestions/goals services. The client half is a
fork of the official 0.2.1 question composer, built into the DSH client
closure format.
