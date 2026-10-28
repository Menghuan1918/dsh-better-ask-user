/**
 * ask_user_question scope shadow: the official tool definition, schema, output
 * and execute path verbatim. The ask-user row only supplies the default wait
 * when the model omits the timeout argument; explicit model timeouts and every
 * validation or error stay exactly those of @deepseek-ai/dsh-tool-ask-user.
 */
export function createBetterAskTool(_ctx, base, readConfig) {
  const execute = async (args, exec) => {
    const { questionTimeoutSeconds } = readConfig()
    const withDefault = args.timeout === undefined
      ? { ...args, timeout: questionTimeoutSeconds }
      : args
    return base.execute(withDefault, exec)
  }
  return { ...base, execute }
}
