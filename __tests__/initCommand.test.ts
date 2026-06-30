import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { initCommand } from '../src/init.js'

const readJson = (path: string): Record<string, any> => JSON.parse(readFileSync(path, 'utf-8'))

let root: string
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // process.exit would tear down the test worker; make it observable instead.
  vi.spyOn(process, 'exit').mockImplementation(((code?: number): never => {
    throw new Error(`process.exit:${code}`)
  }) as never)
  // No test should reach the network unless it explicitly opts in.
  fetchMock = vi.fn(() => Promise.reject(new Error('network disabled in tests')))
  vi.stubGlobal('fetch', fetchMock)
  root = mkdtempSync(join(tmpdir(), 'ipm-init-cmd-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

describe('initCommand', () => {
  it('scaffolds a package with no theme appearance', async () => {
    await initCommand({ name: join(root, 'my-plugin'), type: 'package' })

    const dir = join(root, 'my-plugin')
    const pkg = readJson(join(dir, 'package.json'))
    expect(pkg.theme).toBeUndefined()
    expect(pkg.themeAppearance).toBeUndefined()
    expect(pkg.scripts.build).toBe('tsdown')
    // All placeholders are resolved.
    expect(readFileSync(join(dir, 'package.json'), 'utf-8')).not.toContain('__')
  })

  it('defaults to the package type when none is given', async () => {
    await initCommand({ name: join(root, 'def-plugin') })

    const pkg = readJson(join(root, 'def-plugin', 'package.json'))
    expect(pkg.theme).toBeUndefined()
    expect(pkg.scripts.build).toBe('tsdown')
  })

  it('scaffolds a theme and infers a dark appearance from the name', async () => {
    await initCommand({ name: join(root, 'midnight-dark'), type: 'theme' })

    const dir = join(root, 'midnight-dark')
    const pkg = readJson(join(dir, 'package.json'))
    expect(pkg.theme).toBe(true)
    expect(pkg.themeAppearance).toBe('dark')
    // A unified theme ships ui / syntax / preview stylesheets.
    expect(existsSync(join(dir, 'styles', 'ui.css'))).toBe(true)
    expect(existsSync(join(dir, 'styles', 'syntax.css'))).toBe(true)
    expect(existsSync(join(dir, 'styles', 'preview.css'))).toBe(true)
    // All placeholders are resolved.
    expect(readFileSync(join(dir, 'package.json'), 'utf-8')).not.toContain('__')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('infers a light appearance from the name', async () => {
    await initCommand({ name: join(root, 'solar-light'), type: 'theme' })

    const pkg = readJson(join(root, 'solar-light', 'package.json'))
    expect(pkg.theme).toBe(true)
    expect(pkg.themeAppearance).toBe('light')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses a custom --template directory', async () => {
    const customDir = join(root, '_tmpl')
    mkdirSync(join(customDir, 'styles'), { recursive: true })
    writeFileSync(
      join(customDir, 'package.json'),
      JSON.stringify({
        name: '__package-name__',
        theme: true,
        themeAppearance: '__theme-appearance__'
      })
    )
    writeFileSync(join(customDir, 'styles', 'ui.css'), '/* custom */')

    await initCommand({
      name: join(root, 'custom-dark'),
      type: 'theme',
      template: customDir
    })

    const dir = join(root, 'custom-dark')
    expect(readFileSync(join(dir, 'styles', 'ui.css'), 'utf-8')).toBe('/* custom */')
    expect(readJson(join(dir, 'package.json')).themeAppearance).toBe('dark')
  })

  it('rejects an invalid type and reports the error', async () => {
    await expect(initCommand({ name: join(root, 'x'), type: 'bogus' })).rejects.toThrow(
      'process.exit:1'
    )
    expect(vi.mocked(console.error)).toHaveBeenCalled()
  })
})
