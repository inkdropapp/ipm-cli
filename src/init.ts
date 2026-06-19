import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'

import { createPrompter } from './input.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** The scaffolding templates `ipm init` can generate. */
export const TEMPLATE_TYPES = ['package', 'theme-ui', 'theme-syntax', 'theme-preview'] as const

export type TemplateType = (typeof TEMPLATE_TYPES)[number]

/** A playful emoji for each template type, shown in the wizard menu. */
const TYPE_EMOJI: Record<TemplateType, string> = {
  package: '🧩',
  'theme-ui': '🎨',
  'theme-syntax': '🌈',
  'theme-preview': '📄'
}

export interface InitOptions {
  /** Package/theme name; a new directory of this name is created in the cwd. */
  name?: string
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
 *
 * `extraReplacements` maps additional literal tokens to values, applied to
 * file contents after the built-in placeholders.
 */
export function generateFromTemplate(
  targetPath: string,
  templatePath: string,
  packageName: string,
  extraReplacements: Record<string, string> = {}
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
    const contents = Object.entries(extraReplacements).reduce(
      (acc, [token, value]) => acc.split(token).join(value),
      replaceCurrentYearPlaceholders(
        replacePackageAuthorPlaceholders(
          replacePackageNamePlaceholders(raw, packageName),
          packageAuthor
        )
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

/**
 * The required name suffix for a theme type (`theme-ui` → `-ui`,
 * `theme-syntax` → `-syntax`, …); `''` for a package, which has none.
 */
function themeSuffix(type: TemplateType): string {
  return type === 'package' ? '' : type.slice('theme'.length)
}

/** Print the type-specific next-steps message after scaffolding. */
function printNextSteps(type: TemplateType, targetPath: string, packageName: string): void {
  console.log(chalk.green(`\n🎉 Created ${type} "${packageName}" at ${targetPath}\n`))
  console.log(chalk.bold('👉 Next steps:'))
  console.log(`  cd ${packageName}`)

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

/** Asks the user a question and resolves with their trimmed answer. */
type Ask = (question: string) => Promise<string>

/**
 * Interactively collect a name and type when `ipm init` is run with no name.
 * Loops until a non-empty name and a valid type are given; an empty type
 * answer accepts `defaultType`.
 */
async function runInitWizard(
  ask: Ask,
  defaultType: TemplateType
): Promise<{ name: string; type: TemplateType }> {
  console.log(chalk.bold('✨ Create a new Inkdrop package or theme\n'))

  let name = await ask('📝 Name (a ./<name> directory is created here): ')
  while (!name) {
    console.log(chalk.yellow('  A name is required.'))
    name = await ask('Name: ')
  }

  console.log('\nType:')
  TEMPLATE_TYPES.forEach((t, i) => {
    const marker = t === defaultType ? chalk.gray(' (default)') : ''
    console.log(`  ${i + 1}. ${TYPE_EMOJI[t]} ${t}${marker}`)
  })

  let type: TemplateType | undefined
  while (!type) {
    const answer = await ask(`Choose [1-${TEMPLATE_TYPES.length}]: `)
    if (!answer) {
      type = defaultType
      break
    }
    const byIndex = /^\d+$/.test(answer) ? TEMPLATE_TYPES[Number(answer) - 1] : undefined
    const byName = (TEMPLATE_TYPES as readonly string[]).includes(answer)
      ? (answer as TemplateType)
      : undefined
    type = byIndex ?? byName
    if (!type) {
      console.log(chalk.yellow(`  Enter a number 1-${TEMPLATE_TYPES.length} or a type name.`))
    }
  }

  return { name, type }
}

/**
 * Resolve a UI theme's light/dark appearance: inferred from the name when it
 * contains `light` or `dark`, otherwise asked interactively (default `light`).
 */
async function resolveAppearance(name: string, ask: Ask): Promise<'light' | 'dark'> {
  if (/\bdark\b/i.test(name)) {
    return 'dark'
  }
  if (/\blight\b/i.test(name)) {
    return 'light'
  }

  console.log(`\nAppearance:\n  1. 🌞 light${chalk.gray(' (default)')}\n  2. 🌙 dark`)
  let appearance: 'light' | 'dark' | undefined
  while (!appearance) {
    const answer = (await ask('Choose [1-2]: ')).toLowerCase()
    if (!answer || answer === '1' || answer === 'light') {
      appearance = 'light'
    } else if (answer === '2' || answer === 'dark') {
      appearance = 'dark'
    } else {
      console.log(chalk.yellow('  Enter 1 (light) or 2 (dark).'))
    }
  }
  return appearance
}

/**
 * Generate code scaffolding for a new Inkdrop package or theme. Writes local
 * files only — no authentication or network access. With no `name`, runs an
 * interactive wizard to collect the name and type; a UI theme whose name does
 * not state `light`/`dark` is asked for its appearance.
 */
export async function initCommand(options: InitOptions): Promise<void> {
  let type = (options.type ?? 'package') as TemplateType
  if (!TEMPLATE_TYPES.includes(type)) {
    console.error(
      chalk.red(
        `Error: invalid --type "${options.type}". Expected one of: ${TEMPLATE_TYPES.join(', ')}`
      )
    )
    process.exit(1)
  }

  // One prompter, created on first use and reused for every question, so piped
  // input isn't dropped between a closed and a reopened readline.
  let prompter: ReturnType<typeof createPrompter> | undefined
  const ask: Ask = question => {
    prompter ??= createPrompter()
    return prompter.ask(question)
  }

  let name = options.name?.trim()
  let appearance: 'light' | 'dark' | undefined
  try {
    if (!name) {
      const answers = await runInitWizard(ask, type)
      name = answers.name
      type = answers.type
    }

    // Themes must carry the matching name suffix (e.g. theme-ui → `-ui`).
    const suffix = themeSuffix(type)
    if (suffix && !name.endsWith(suffix)) {
      name = `${name}${suffix}`
      console.log(chalk.gray(`Naming it "${name}" — ${type} names end with "${suffix}".`))
    }

    // UI themes carry a light/dark appearance.
    if (type === 'theme-ui') {
      appearance = await resolveAppearance(name, ask)
    }
  } finally {
    prompter?.close()
  }

  if (!name) {
    // Unreachable: the option or the wizard always yields a name.
    console.error(chalk.red('Error: a name is required.'))
    process.exit(1)
  }

  const extraReplacements: Record<string, string> = appearance
    ? { '__theme-appearance__': appearance }
    : {}

  const targetPath = resolve(name)
  const packageName = basename(targetPath)

  try {
    generateFromTemplate(
      targetPath,
      getTemplatePath(type, options.template),
      packageName,
      extraReplacements
    )
  } catch (error) {
    console.error(chalk.red('Failed to generate scaffolding:'), error)
    process.exit(1)
  }

  printNextSteps(type, targetPath, packageName)
}
