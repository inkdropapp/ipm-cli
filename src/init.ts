import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** The scaffolding templates `ipm init` can generate. */
export const TEMPLATE_TYPES = ['package', 'theme-ui', 'theme-syntax', 'theme-preview'] as const

export type TemplateType = (typeof TEMPLATE_TYPES)[number]

export interface InitOptions {
  /** Target directory (defaults to the current working directory). */
  path?: string
  /** Template to generate (defaults to `package`). */
  type?: string
  /** Path to a custom template directory, overriding the built-in one. */
  template?: string
}

/**
 * Dasherize a name: `MyPackage` / `my_package` → `my-package`.
 */
function dasherize(name: string): string {
  const head = name[0].toLowerCase() + name.slice(1)
  return head.replace(/([A-Z])|(_)/g, (_m, letter) => (letter ? `-${letter.toLowerCase()}` : '-'))
}

/**
 * Camelize a name: `my-package` / `my_package` → `myPackage` (the first
 * character's case is set by the caller before this runs).
 */
function camelize(name: string): string {
  return name.replace(/[_-]+(\w)/g, m => m[1].toUpperCase())
}

/**
 * Underscore a name: `MyPackage` / `my-package` → `my_package`.
 */
function underscore(name: string): string {
  const head = name[0].toLowerCase() + name.slice(1)
  return head.replace(/([A-Z])|(-)/g, (_m, letter) => (letter ? `_${letter.toLowerCase()}` : '_'))
}

/**
 * Replace package-name placeholders, dispatching on which casing variant was
 * matched: `__package-name__` → dasherized, `__PackageName__` /
 * `__packageName__` → camelized (preserving the leading capital), and
 * `__package_name__` → underscored.
 */
export function replacePackageNamePlaceholders(input: string, packageName: string): string {
  const placeholderRegex = /__(?:(package-name)|([pP]ackageName)|(package_name))__/g
  return input.replace(placeholderRegex, (match, dash, camel, under) => {
    if (dash) {
      return dasherize(packageName)
    }
    if (camel) {
      const cased = /[A-Z]/.test(camel[0])
        ? packageName[0].toUpperCase() + packageName.slice(1)
        : packageName[0].toLowerCase() + packageName.slice(1)
      return camelize(cased)
    }
    if (under) {
      return underscore(packageName)
    }
    return match
  })
}

/** Replace `__package-author__` with the resolved author name. */
export function replacePackageAuthorPlaceholders(input: string, packageAuthor: string): string {
  return input.replace(/__package-author__/g, packageAuthor)
}

/** Replace `__current_year__` with the current four-digit year. */
export function replaceCurrentYearPlaceholders(input: string): string {
  return input.replace(/__current_year__/g, String(new Date().getFullYear()))
}

/** Recursively collect absolute file paths under `root`. */
function listFilesRecursive(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

/**
 * Copy every file from `templatePath` into `targetPath`, stripping the
 * trailing `.template` suffix, substituting placeholders in both paths and
 * contents, and skipping any destination file that already exists.
 */
export function generateFromTemplate(
  targetPath: string,
  templatePath: string,
  packageName: string
): void {
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`)
  }
  const packageAuthor = process.env.GITHUB_USER || 'inkdropapp'
  mkdirSync(targetPath, { recursive: true })

  for (const templateChildPath of listFilesRecursive(templatePath)) {
    const relativePath = replacePackageNamePlaceholders(
      templateChildPath
        .slice(templatePath.length)
        .replace(/^[/\\]/, '')
        .replace(/\.template$/, ''),
      packageName
    )
    const destPath = join(targetPath, relativePath)
    if (existsSync(destPath)) {
      continue
    }

    mkdirSync(dirname(destPath), { recursive: true })
    const raw = readFileSync(templateChildPath, 'utf-8')
    const contents = replaceCurrentYearPlaceholders(
      replacePackageAuthorPlaceholders(
        replacePackageNamePlaceholders(raw, packageName),
        packageAuthor
      )
    )
    writeFileSync(destPath, contents)
  }
}

/**
 * Resolve the template directory for `type`, or the user-supplied
 * `--template` path when given.
 */
function getTemplatePath(type: TemplateType, customTemplate?: string): string {
  if (customTemplate) {
    return resolve(customTemplate)
  }
  return resolve(__dirname, '..', 'templates', type)
}

/** Print the type-specific next-steps message after scaffolding. */
function printNextSteps(type: TemplateType, targetPath: string, packageName: string): void {
  console.log(chalk.green(`\n✓ Created ${type} "${packageName}" at ${targetPath}\n`))
  console.log(chalk.bold('Next steps:'))
  console.log(`  cd ${targetPath}`)

  if (type === 'package') {
    console.log('  npm install')
    console.log('  npm run build')
  } else if (type === 'theme-ui') {
    console.log('  npm install')
    console.log(
      chalk.gray('  # palette.json is generated on publish (prepublishOnly → generate-palette)')
    )
  } else {
    console.log(chalk.gray('  # edit styles/index.css, then run `ipm publish`'))
  }
}

/**
 * Generate code scaffolding for a new Inkdrop package or theme. Writes local
 * files only — no authentication or network access.
 */
export function initCommand(options: InitOptions): void {
  const type = (options.type ?? 'package') as TemplateType
  if (!TEMPLATE_TYPES.includes(type)) {
    console.error(
      chalk.red(
        `Error: invalid --type "${options.type}". Expected one of: ${TEMPLATE_TYPES.join(', ')}`
      )
    )
    process.exit(1)
  }

  const targetPath = resolve(options.path ?? '.')
  const packageName = basename(targetPath)

  try {
    generateFromTemplate(targetPath, getTemplatePath(type, options.template), packageName)
  } catch (error) {
    console.error(chalk.red('Failed to generate scaffolding:'), error)
    process.exit(1)
  }

  printNextSteps(type, targetPath, packageName)
}
