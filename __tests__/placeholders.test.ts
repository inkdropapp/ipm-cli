import { describe, expect, it } from 'vitest'

import {
  replaceCurrentYearPlaceholders,
  replacePackageAuthorPlaceholders,
  replacePackageNamePlaceholders,
  TEMPLATE_TYPES
} from '../src/init.js'

describe('replacePackageNamePlaceholders', () => {
  it('dasherizes __package-name__', () => {
    expect(replacePackageNamePlaceholders('pkg: __package-name__', 'MyCoolPackage')).toBe(
      'pkg: my-cool-package'
    )
  })

  it('leaves an already-dasherized name unchanged', () => {
    expect(replacePackageNamePlaceholders('__package-name__', 'my-cool-package')).toBe(
      'my-cool-package'
    )
  })

  it('camelizes __packageName__ with a lowercase leader', () => {
    expect(replacePackageNamePlaceholders('__packageName__', 'my-cool-package')).toBe(
      'myCoolPackage'
    )
  })

  it('camelizes __PackageName__ preserving the leading capital', () => {
    expect(replacePackageNamePlaceholders('__PackageName__', 'my-cool-package')).toBe(
      'MyCoolPackage'
    )
  })

  it('underscores __package_name__', () => {
    expect(replacePackageNamePlaceholders('__package_name__', 'MyCoolPackage')).toBe(
      'my_cool_package'
    )
  })

  it('replaces every casing variant within one string', () => {
    const template = '__package-name__ / __packageName__ / __PackageName__ / __package_name__'
    expect(replacePackageNamePlaceholders(template, 'my-cool-package')).toBe(
      'my-cool-package / myCoolPackage / MyCoolPackage / my_cool_package'
    )
  })

  it('leaves text without placeholders untouched', () => {
    expect(replacePackageNamePlaceholders('no placeholders here', 'whatever')).toBe(
      'no placeholders here'
    )
  })
})

describe('replacePackageAuthorPlaceholders', () => {
  it('replaces every __package-author__ occurrence', () => {
    expect(
      replacePackageAuthorPlaceholders('by __package-author__ and __package-author__', 'octocat')
    ).toBe('by octocat and octocat')
  })
})

describe('replaceCurrentYearPlaceholders', () => {
  it('replaces __current_year__ with the four-digit year', () => {
    const year = String(new Date().getFullYear())
    expect(replaceCurrentYearPlaceholders('© __current_year__')).toBe(`© ${year}`)
  })
})

describe('TEMPLATE_TYPES', () => {
  it('lists the supported scaffolds', () => {
    expect(TEMPLATE_TYPES).toEqual(['package', 'theme-ui', 'theme-syntax', 'theme-preview'])
  })
})
