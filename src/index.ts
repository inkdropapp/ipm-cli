import chalk from 'chalk'
import { Command } from 'commander'
import { getAccessToken, openAccessKeyPage, saveAccessToken } from './auth.js'
import { INKDROP_ACCESS_KEY_URI } from './consts.js'
import { prompt } from './input.js'
import { getIPM } from './ipm.js'

/**
 * Configure the CLI tool by authenticating with the Inkdrop service
 */
async function configure() {
  console.log(chalk.bold('Configuring Inkdrop CLI...\n'))

  // Check if already authenticated
  const existingToken = getAccessToken()
  if (existingToken) {
    console.log(chalk.green('✓ You are already authenticated.'))
    const answer = await prompt(
      'Do you want to reconfigure with a new access token? (y/N): '
    )
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(chalk.yellow('Configuration cancelled.'))
      return
    }
  }

  // Open the desktop app to display the access key
  console.log(
    chalk.cyan('Opening Inkdrop desktop app to display your access key...')
  )
  console.log(chalk.underline(INKDROP_ACCESS_KEY_URI))
  console.log(
    `If it doesn't open automatically, run the command ${chalk.bold('application:display-access-key')} in the Inkdrop app.`
  )
  await openAccessKeyPage()

  // Prompt for the access token
  const token = await prompt(
    '\nPlease paste your access token from the desktop app: '
  )

  if (!token) {
    console.error(chalk.red('Error: Access token cannot be empty.'))
    process.exit(1)
  }

  // Save the token
  try {
    saveAccessToken(token)
    console.log(chalk.green('\n✓ Access token saved successfully!'))
    console.log('You can now use the Inkdrop CLI.')
  } catch (error) {
    console.error(chalk.red('Error saving access token:'), error)
    process.exit(1)
  }
}

/**
 * Check if the user is authenticated and prompt to configure if not
 */
export async function ensureAuthenticated() {
  const token = getAccessToken()
  if (!token) {
    console.log(chalk.yellow('You are not authenticated yet.'))
    await configure()
  }
  return getAccessToken()
}

export async function main() {
  const program = new Command()

  program
    .name('ipm')
    .description('Inkdrop Plugin Manager - Manage your Inkdrop plugins')
    .version('0.1.0')

  program
    .command('configure')
    .description('Configure the CLI by setting up authentication')
    .action(async () => {
      await configure()
    })

  program
    .command('list')
    .alias('ls')
    .description('List installed packages')
    .action(async () => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        console.log(chalk.cyan('Fetching installed packages...'))
        const packages = await ipm.getInstalled()

        if (packages.length === 0) {
          console.log(chalk.yellow('No packages installed.'))
          return
        }

        console.log(chalk.bold(`\nInstalled packages (${packages.length}):\n`))
        for (const pkg of packages) {
          console.log(
            `  ${chalk.cyan(pkg.name)}${chalk.gray('@')}${chalk.green(pkg.version)}${pkg.description ? chalk.gray(` - ${pkg.description}`) : ''}`
          )
        }
      } catch (error) {
        console.error(chalk.red('Failed to fetch installed packages:'), error)
        process.exit(1)
      }
    })

  program
    .command('outdated')
    .description('List outdated packages')
    .action(async () => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        console.log(chalk.cyan('Checking for outdated packages...'))
        const outdated = await ipm.getOutdated()

        if (outdated.length === 0) {
          console.log(chalk.green('All packages are up to date.'))
          return
        }

        console.log(chalk.bold(`\nOutdated packages (${outdated.length}):\n`))
        for (const pkg of outdated) {
          console.log(
            `  ${chalk.cyan(pkg.name)}: ${chalk.yellow(pkg.version)} → ${chalk.green(pkg.latestVersion)}`
          )
        }
      } catch (error) {
        console.error(chalk.red('Failed to check outdated packages:'), error)
        process.exit(1)
      }
    })

  program
    .command('install <package>')
    .alias('i')
    .description('Install a package')
    .option('-v, --version <version>', 'Specific version to install')
    .action(async (packageName: string, options: { version?: string }) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        const versionStr = options.version ? `@${options.version}` : ''
        console.log(chalk.cyan(`Installing ${packageName}${versionStr}...`))
        await ipm.install(packageName, options.version)
        console.log(
          chalk.green(`✓ Successfully installed ${packageName}${versionStr}`)
        )
      } catch (error) {
        console.error(chalk.red(`Failed to install ${packageName}:`), error)
        process.exit(1)
      }
    })

  program
    .command('update <package>')
    .description('Update a package')
    .option('-v, --version <version>', 'Specific version to update to')
    .action(async (packageName: string, options: { version?: string }) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        const versionStr = options.version ? `@${options.version}` : ''
        console.log(chalk.cyan(`Updating ${packageName}${versionStr}...`))
        await ipm.update(packageName, options.version)
        console.log(
          chalk.green(`✓ Successfully updated ${packageName}${versionStr}`)
        )
      } catch (error) {
        console.error(chalk.red(`Failed to update ${packageName}:`), error)
        process.exit(1)
      }
    })

  program
    .command('uninstall <package>')
    .alias('remove')
    .description('Uninstall a package')
    .action(async (packageName: string) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        console.log(chalk.cyan(`Uninstalling ${packageName}...`))
        const result = await ipm.uninstall(packageName)
        if (result) {
          console.log(chalk.green(`✓ Successfully uninstalled ${packageName}`))
        } else {
          console.warn(chalk.yellow(`Package ${packageName} was not installed`))
        }
      } catch (error) {
        console.error(chalk.red(`Failed to uninstall ${packageName}:`), error)
        process.exit(1)
      }
    })

  program
    .command('search <query>')
    .description('Search for packages')
    .option(
      '-s, --sort <sort>',
      'Sort order (score, majority, recency, newness)'
    )
    .option('-d, --direction <direction>', 'Sort direction (asc, desc)')
    .action(
      async (query: string, options: { sort?: string; direction?: string }) => {
        await ensureAuthenticated()
        const ipm = getIPM()

        try {
          console.log(chalk.cyan(`Searching for "${query}"...`))
          const results = await ipm.registry.search({
            q: query,
            sort: options.sort as any,
            direction: options.direction
          })

          if (results.length === 0) {
            console.log(chalk.yellow('No packages found.'))
            return
          }

          console.log(chalk.bold(`\nFound ${results.length} package(s):\n`))
          for (const pkg of results) {
            console.log(
              `└── ${chalk.cyan(pkg.name)} ${chalk.gray(`(v${pkg.releases.latest})`)}`
            )
            if (pkg.metadata.description) {
              console.log(chalk.gray(`    ${pkg.metadata.description}`))
            }
            console.log(chalk.gray(`    Downloads: ${pkg.downloads}`))
            console.log('')
          }
          console.log(
            `Use \`ipm install\` to install them or visit ` +
              chalk.underline(`https://my.inkdrop.app/plugins`) +
              ` to read more about them.`
          )
        } catch (error) {
          console.error(chalk.red('Search failed:'), error)
          process.exit(1)
        }
      }
    )

  program
    .command('show <package>')
    .description('Show package information')
    .action(async (packageName: string) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        console.log(chalk.cyan(`Fetching information for ${packageName}...`))
        const info = await ipm.registry.getPackageInfo(packageName)

        console.log(chalk.bold(`\nPackage: ${chalk.cyan(info.name)}`))
        console.log(`├── Latest version: ${chalk.green(info.releases.latest)}`)
        if (info.metadata.description) {
          console.log(`├── Description: ${info.metadata.description}`)
        }
        if (info.repository) {
          console.log(`├── Repository: ${chalk.blue(info.repository)}`)
        }
        console.log(`├── Downloads: ${chalk.yellow(info.downloads.toString())}`)
        if (info.metadata.engines?.inkdrop) {
          console.log(
            `└── Supported Inkdrop version: ${info.metadata.engines.inkdrop}`
          )
        }
      } catch (error) {
        console.error(chalk.red(`Failed to fetch package info:`), error)
        process.exit(1)
      }
    })

  program
    .command('publish [path]')
    .description('Publish a package to the registry')
    .option(
      '--dry-run',
      'Simulate the publish process without actually publishing'
    )
    .action(async (path: string | undefined, options: { dryRun?: boolean }) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        const pathStr = path ? ` from ${path}` : ''
        if (options.dryRun) {
          console.log(
            chalk.cyan(`Running publish in dry-run mode${pathStr}...`)
          )
        } else {
          console.log(chalk.cyan(`Publishing package${pathStr}...`))
        }

        // Type assertion needed as the type definition is outdated but the README shows path is supported
        await ipm.publish({ dryrun: options.dryRun || false, path } as any)

        if (options.dryRun) {
          console.log(chalk.green('✓ Dry-run completed successfully!'))
          console.log(chalk.gray('No changes were made to the registry.'))
        } else {
          console.log(chalk.green('✓ Package published successfully!'))
        }
      } catch (error) {
        console.error(chalk.red('Failed to publish package:'), error)
        process.exit(1)
      }
    })

  await program.parseAsync(process.argv)
}
