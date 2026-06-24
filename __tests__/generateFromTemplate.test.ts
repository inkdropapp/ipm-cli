import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generateFromTemplate } from '../src/init.js'

let workdir: string
let templateDir: string
let targetDir: string
const savedGithubUser = process.env.GITHUB_USER

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'ipm-gen-'))
  templateDir = join(workdir, 'template')
  targetDir = join(workdir, 'target')
  mkdirSync(templateDir, { recursive: true })
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
  if (savedGithubUser === undefined) {
    delete process.env.GITHUB_USER
  } else {
    process.env.GITHUB_USER = savedGithubUser
  }
})

describe('generateFromTemplate', () => {
  it('substitutes placeholders in paths and contents, stripping the .template suffix', () => {
    writeFileSync(
      join(templateDir, '__package-name__.json.template'),
      '{ "name": "__package-name__" }'
    )
    mkdirSync(join(templateDir, 'src'))
    writeFileSync(
      join(templateDir, 'src', '__PackageName__.ts.template'),
      'export class __PackageName__ {}'
    )

    generateFromTemplate(targetDir, templateDir, 'my-cool-package')

    expect(readFileSync(join(targetDir, 'my-cool-package.json'), 'utf-8')).toBe(
      '{ "name": "my-cool-package" }'
    )
    expect(readFileSync(join(targetDir, 'src', 'MyCoolPackage.ts'), 'utf-8')).toBe(
      'export class MyCoolPackage {}'
    )
  })

  it('keeps non-.template filenames but still replaces in-content placeholders', () => {
    writeFileSync(join(templateDir, 'README.md'), '# __package-name__')

    generateFromTemplate(targetDir, templateDir, 'my-pkg')

    expect(readFileSync(join(targetDir, 'README.md'), 'utf-8')).toBe('# my-pkg')
  })

  it('replaces author, year, and caller-supplied extra tokens', () => {
    process.env.GITHUB_USER = 'octocat'
    const year = String(new Date().getFullYear())
    writeFileSync(
      join(templateDir, 'LICENSE.template'),
      'Copyright __current_year__ __package-author__ — __theme-appearance__'
    )

    generateFromTemplate(targetDir, templateDir, 'my-pkg', { '__theme-appearance__': 'dark' })

    expect(readFileSync(join(targetDir, 'LICENSE'), 'utf-8')).toBe(
      `Copyright ${year} octocat — dark`
    )
  })

  it('defaults the author to inkdropapp when GITHUB_USER is unset', () => {
    delete process.env.GITHUB_USER
    writeFileSync(join(templateDir, 'a.txt.template'), '__package-author__')

    generateFromTemplate(targetDir, templateDir, 'my-pkg')

    expect(readFileSync(join(targetDir, 'a.txt'), 'utf-8')).toBe('inkdropapp')
  })

  it('never overwrites an existing destination file', () => {
    writeFileSync(join(templateDir, 'keep.txt.template'), 'from template')
    mkdirSync(targetDir, { recursive: true })
    writeFileSync(join(targetDir, 'keep.txt'), 'user edits')

    generateFromTemplate(targetDir, templateDir, 'my-pkg')

    expect(readFileSync(join(targetDir, 'keep.txt'), 'utf-8')).toBe('user edits')
  })

  it('throws when the template directory does not exist', () => {
    expect(() => generateFromTemplate(targetDir, join(workdir, 'nope'), 'my-pkg')).toThrow(
      /Template not found/
    )
    expect(existsSync(targetDir)).toBe(false)
  })
})
