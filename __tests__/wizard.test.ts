import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Replace the readline-backed prompter with a scripted one so the interactive
// wizard and appearance prompts can be driven without real stdin.
vi.mock('../src/input.js', () => ({ createPrompter: vi.fn() }))

import { initCommand } from '../src/init.js'
import { createPrompter } from '../src/input.js'

const readJson = (path: string): Record<string, any> => JSON.parse(readFileSync(path, 'utf-8'))

/** Feed the wizard a fixed list of answers, consumed in order. */
function scriptPrompter(answers: string[]) {
  let i = 0
  const ask = vi.fn(() => Promise.resolve(answers[i++] ?? ''))
  const close = vi.fn()
  vi.mocked(createPrompter).mockReturnValue({ ask, close })
  return { ask, close }
}

let root: string

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(process, 'exit').mockImplementation(((code?: number): never => {
    throw new Error(`process.exit:${code}`)
  }) as never)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network disabled in tests')))
  )
  root = mkdtempSync(join(tmpdir(), 'ipm-wizard-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

describe('init wizard (no name given)', () => {
  it('prompts for name, a type chosen by number, then a dark appearance', async () => {
    // 2 = theme, 2 = dark
    const { close } = scriptPrompter([join(root, 'wiz'), '2', '2'])

    await initCommand({})

    const pkg = readJson(join(root, 'wiz', 'package.json'))
    expect(pkg.theme).toBe(true)
    expect(pkg.themeAppearance).toBe('dark')
    expect(close).toHaveBeenCalled()
  })

  it('re-prompts on an empty name, accepts a type chosen by name', async () => {
    // '' is rejected, then the path; 'theme' by name; '1' = light
    scriptPrompter(['', join(root, 'wiz2'), 'theme', '1'])

    await initCommand({})

    expect(readJson(join(root, 'wiz2', 'package.json')).themeAppearance).toBe('light')
  })

  it('falls back to the default type on an empty type answer', async () => {
    // empty type answer accepts the default passed in (theme); 2 = dark
    scriptPrompter([join(root, 'wiz3'), '', '2'])

    await initCommand({ type: 'theme' })

    expect(readJson(join(root, 'wiz3', 'package.json')).themeAppearance).toBe('dark')
  })

  it('re-prompts on an unknown type, and a package needs no appearance', async () => {
    // '99' is out of range → re-prompt; '1' = package (no appearance question)
    const { ask } = scriptPrompter([join(root, 'wiz4'), '99', '1'])

    await initCommand({})

    expect(existsSync(join(root, 'wiz4', 'package.json'))).toBe(true)
    // name, invalid type, valid type — no fourth (appearance) question for a package.
    expect(ask).toHaveBeenCalledTimes(3)
  })
})

describe('appearance prompt (name lacks light/dark)', () => {
  it('defaults to light on an empty answer', async () => {
    scriptPrompter([''])

    await initCommand({ name: join(root, 'plain'), type: 'theme' })

    expect(readJson(join(root, 'plain', 'package.json')).themeAppearance).toBe('light')
  })

  it('re-prompts on an invalid answer, then accepts "dark"', async () => {
    scriptPrompter(['maybe', 'dark'])

    await initCommand({ name: join(root, 'plain2'), type: 'theme' })

    expect(readJson(join(root, 'plain2', 'package.json')).themeAppearance).toBe('dark')
  })
})
