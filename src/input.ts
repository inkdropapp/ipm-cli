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
