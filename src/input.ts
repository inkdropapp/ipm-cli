import { createInterface } from 'node:readline'

/**
 * Prompt the user for input
 * @param question The question to ask
 * @returns The user's input
 */
export function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Open a readline interface for asking a sequence of questions (e.g. a wizard).
 * Unlike {@link prompt}, it keeps stdin open across questions, so it also works
 * with piped/non-TTY input. Call `close()` when done.
 */
export function createPrompter(): {
  ask: (question: string) => Promise<string>
  close: () => void
} {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // Buffer lines so answers aren't dropped when stdin is piped: readline can
  // emit several `line` events before the next `ask` registers its listener.
  const buffered: string[] = []
  const waiting: ((line: string) => void)[] = []
  rl.on('line', line => {
    const resolveNext = waiting.shift()
    if (resolveNext) {
      resolveNext(line.trim())
    } else {
      buffered.push(line.trim())
    }
  })

  return {
    ask(question) {
      process.stdout.write(question)
      const next = buffered.shift()
      return next !== undefined
        ? Promise.resolve(next)
        : new Promise(resolve => waiting.push(resolve))
    },
    close: () => rl.close()
  }
}
