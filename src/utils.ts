import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import chalk from 'chalk'

/**
 * Run the plugin's `prepublishOnly` npm script if it is defined in the
 * plugin's package.json. This lets plugin authors build/validate before
 * the package is published to the registry.
 */
export function runPrepublishOnly(pluginPath: string | undefined) {
  const pluginDir = pluginPath ? resolve(pluginPath) : process.cwd()
  const manifestPath = resolve(pluginDir, 'package.json')
  if (!existsSync(manifestPath)) {
    return
  }

  let manifest: { scripts?: Record<string, string> }
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  } catch (error) {
    throw new Error(`Failed to read ${manifestPath}: ${String(error)}`)
  }

  if (!manifest.scripts?.prepublishOnly) {
    return
  }

  console.log(chalk.cyan('Running prepublishOnly script...'))
  const result = spawnSync('npm', ['run', 'prepublishOnly'], {
    cwd: pluginDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`prepublishOnly script exited with code ${result.status}`)
  }
}
