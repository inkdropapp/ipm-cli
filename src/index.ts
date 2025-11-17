import { Command } from 'commander'
import { getAccessToken, openAccessKeyPage, saveAccessToken } from './auth.js'
import { prompt } from './input.js'
import { getIPM } from './ipm.js'

/**
 * Configure the CLI tool by authenticating with the Inkdrop service
 */
async function configure() {
  console.log('Configuring Inkdrop CLI...\n')

  // Check if already authenticated
  const existingToken = getAccessToken()
  if (existingToken) {
    console.log('✓ You are already authenticated.')
    const answer = await prompt(
      'Do you want to reconfigure with a new access token? (y/N): '
    )
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Configuration cancelled.')
      return
    }
  }

  // Open the desktop app to display the access key
  console.log('Opening Inkdrop desktop app to display your access key...')
  await openAccessKeyPage()

  // Prompt for the access token
  const token = await prompt(
    '\nPlease paste your access token from the desktop app: '
  )

  if (!token) {
    console.error('Error: Access token cannot be empty.')
    process.exit(1)
  }

  // Save the token
  try {
    saveAccessToken(token)
    console.log('\n✓ Access token saved successfully!')
    console.log('You can now use the Inkdrop CLI.')
  } catch (error) {
    console.error('Error saving access token:', error)
    process.exit(1)
  }
}

/**
 * Check if the user is authenticated and prompt to configure if not
 */
export async function ensureAuthenticated() {
  const token = getAccessToken()
  if (!token) {
    console.log('You are not authenticated yet.')
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
        console.log('Fetching installed packages...')
        const packages = await ipm.getInstalled()

        if (packages.length === 0) {
          console.log('No packages installed.')
          return
        }

        console.log(`\nInstalled packages (${packages.length}):\n`)
        for (const pkg of packages) {
          console.log(
            `  ${pkg.name}@${pkg.version}${pkg.description ? ` - ${pkg.description}` : ''}`
          )
        }
      } catch (error) {
        console.error('Failed to fetch installed packages:', error)
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
        console.log('Checking for outdated packages...')
        const outdated = await ipm.getOutdated()

        if (outdated.length === 0) {
          console.log('All packages are up to date.')
          return
        }

        console.log(`\nOutdated packages (${outdated.length}):\n`)
        for (const pkg of outdated) {
          console.log(`  ${pkg.name}: ${pkg.version} → ${pkg.latestVersion}`)
        }
      } catch (error) {
        console.error('Failed to check outdated packages:', error)
        process.exit(1)
      }
    })

  program
    .command('install <package>')
    .description('Install a package')
    .option('-v, --version <version>', 'Specific version to install')
    .action(async (packageName: string, options: { version?: string }) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        const versionStr = options.version ? `@${options.version}` : ''
        console.log(`Installing ${packageName}${versionStr}...`)
        await ipm.install(packageName, options.version)
        console.log(`✓ Successfully installed ${packageName}${versionStr}`)
      } catch (error) {
        console.error(`Failed to install ${packageName}:`, error)
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
        console.log(`Updating ${packageName}${versionStr}...`)
        await ipm.update(packageName, options.version)
        console.log(`✓ Successfully updated ${packageName}${versionStr}`)
      } catch (error) {
        console.error(`Failed to update ${packageName}:`, error)
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
        console.log(`Uninstalling ${packageName}...`)
        const result = await ipm.uninstall(packageName)
        if (result) {
          console.log(`✓ Successfully uninstalled ${packageName}`)
        } else {
          console.warn(`Package ${packageName} was not installed`)
        }
      } catch (error) {
        console.error(`Failed to uninstall ${packageName}:`, error)
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
          console.log(`Searching for "${query}"...`)
          const results = await ipm.registry.search({
            q: query,
            sort: options.sort as any,
            direction: options.direction
          })

          if (results.length === 0) {
            console.log('No packages found.')
            return
          }

          console.log(`\nFound ${results.length} package(s):\n`)
          for (const pkg of results) {
            console.log(`  ${pkg.name} (v${pkg.releases.latest})`)
            if (pkg.metadata.description) {
              console.log(`    ${pkg.metadata.description}`)
            }
            console.log(`    Downloads: ${pkg.downloads}`)
            console.log('')
          }
        } catch (error) {
          console.error('Search failed:', error)
          process.exit(1)
        }
      }
    )

  program
    .command('info <package>')
    .description('Show package information')
    .action(async (packageName: string) => {
      await ensureAuthenticated()
      const ipm = getIPM()

      try {
        console.log(`Fetching information for ${packageName}...`)
        const info = await ipm.registry.getPackageInfo(packageName)

        console.log(`\nPackage: ${info.name}`)
        console.log(`Latest version: ${info.releases.latest}`)
        if (info.metadata.description) {
          console.log(`Description: ${info.metadata.description}`)
        }
        if (info.repository) {
          console.log(`Repository: ${info.repository}`)
        }
        if (info.metadata.license) {
          console.log(`License: ${info.metadata.license}`)
        }
        console.log(`Downloads: ${info.downloads}`)
        if (info.metadata.keywords && info.metadata.keywords.length > 0) {
          console.log(`Keywords: ${info.metadata.keywords.join(', ')}`)
        }
        if (info.metadata.engines?.inkdrop) {
          console.log(`Inkdrop version: ${info.metadata.engines.inkdrop}`)
        }
      } catch (error) {
        console.error(`Failed to fetch package info:`, error)
        process.exit(1)
      }
    })

  await program.parseAsync(process.argv)
}
