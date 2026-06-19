# @inkdropapp/ipm-cli

The CLI tool for managing [Inkdrop](https://www.inkdrop.app/) plugins and themes.

## Installation

```bash
npm install -g @inkdropapp/ipm-cli
```

## Getting Started

Before using the CLI, you need to configure authentication with your Inkdrop account:

```bash
ipm configure
```

This will:

1. Open the Inkdrop desktop app to display your access key
2. Prompt you to paste the access key in the terminal
3. Securely store the credentials in your system keyring

## Usage

### Basic Commands

#### List installed packages

```bash
ipm list
# or
ipm ls
```

Shows all packages currently installed in your Inkdrop.

#### Check for outdated packages

```bash
ipm outdated
```

Lists packages that have newer versions available.

#### Install a package

```bash
# Install latest version
ipm install <package-name>
# or
ipm i <package-name>

# Install specific version (package@version format)
ipm install <package-name>@1.2.3
ipm i <package-name>@1.2.3

# Install specific version (--version flag)
ipm install <package-name> --version 1.2.3
# or
ipm i <package-name> -v 1.2.3
```

#### Update a package

```bash
# Update to latest version
ipm update <package-name>

# Update to specific version (package@version format)
ipm update <package-name>@1.2.3

# Update to specific version (--version flag)
ipm update <package-name> --version 1.2.3
# or
ipm update <package-name> -v 1.2.3
```

#### Uninstall a package

```bash
ipm uninstall <package-name>
# or
ipm remove <package-name>
```

#### Scaffold a new package or theme

```bash
# Create a plugin in ./my-plugin (default type is `package`)
ipm init my-plugin

# Create a theme — theme-ui, theme-syntax, or theme-preview
ipm init my-theme --type theme-ui
ipm init my-theme -t theme-syntax

# Use a custom template directory
ipm init my-plugin --template /path/to/template

# Omit the name to launch an interactive wizard
ipm init
```

Generates code scaffolding for a new Inkdrop **package** or **theme** in a new `./<name>` directory. No authentication required — it only writes local files.

Types (`-t, --type`):

- `package` (default) — a TypeScript plugin built with [tsdown](https://tsdown.dev/) and typed with [`@inkdropapp/types`](https://github.com/inkdropapp/types).
- `theme-ui` — a UI (app chrome) theme. Ships `@inkdropapp/theme-dev-helpers`; `ipm publish` runs `generate-palette` to emit `palette.json`.
- `theme-syntax` — an editor (CodeMirror) syntax theme.
- `theme-preview` — a Markdown preview theme.

Theme names get the matching suffix automatically (`my-theme --type theme-ui` → `my-theme-ui`). For UI themes, the light/dark appearance is read from the name when it contains `light` or `dark`, otherwise you're asked. Run `ipm init` with no name for an interactive wizard that prompts for the name, type, and (for UI themes) appearance.

Then follow the printed next steps, for example:

```bash
cd my-plugin
npm install
npm run build
ipm link # symlink into Inkdrop for local testing
```

#### Link a package for development

```bash
# Link current directory
ipm link
# or
ipm ln

# Link a specific directory
ipm link ./path/to/package

# Link to dev/packages (for plugin development)
ipm link --dev
# or
ipm link -d

# Link with a custom package name
ipm link --name my-plugin
# or
ipm link -n my-plugin

# Combine options
ipm link ./path/to/package -d -n my-plugin
```

Creates a symlink from the Inkdrop packages directory to a local package directory, enabling local plugin development. The `--dev` flag links to `dev/packages` instead of `packages`, which is useful for developing plugins without affecting your stable setup. The package name is read from `package.json` in the linked directory, or falls back to the directory name.

#### Search for packages

```bash
# Basic search
ipm search <query>

# Search with sorting
ipm search <query> --sort recency
ipm search <query> -s score -d desc
```

Available sort options:

- `score` - Relevance score (default)
- `majority` - Most popular
- `recency` - Recently updated
- `newness` - Recently published

#### Show package information

```bash
ipm show <package-name>
```

Displays detailed information about a package including:

- Latest version
- Description
- Repository URL
- Download count
- Supported Inkdrop version

#### Publish a package

```bash
# Publish from current directory
ipm publish

# Publish from specific directory
ipm publish ./path/to/package

# Dry-run (simulate publishing without actually doing it)
ipm publish --dry-run
ipm publish ./path/to/package --dry-run
```

It is recommended to use [`npm version`](https://docs.npmjs.com/cli/v11/commands/npm-version) to bump the package version before publishing. For example:

```bash
# Bump up the patch version
npm version patch
ipm publish
```

#### Unpublish a package

```bash
# Unpublish entire package
ipm unpublish <package-name>

# Unpublish specific version (package@version format)
ipm unpublish <package-name>@1.2.3

# Unpublish specific version (--version flag)
ipm unpublish <package-name> --version 1.2.3
# or
ipm unpublish <package-name> -v 1.2.3
```

**Warning**: This command will prompt for confirmation before unpublishing. Unpublishing a package or version is a destructive action and cannot be undone.

### Configuration

Reconfigure authentication (e.g., to use a different account):

```bash
ipm configure
```

## Environment Variables

You can customize the behavior of the CLI using the following environment variables:

### Authentication

- `INKDROP_ACCESS_KEY_ID` - Your Inkdrop access key ID (overrides stored credentials)
- `INKDROP_SECRET_ACCESS_KEY` - Your Inkdrop secret access key (overrides stored credentials)

### Paths

- `INKDROP_HOME` - Path to Inkdrop's home directory (default: `~/Library/Application Support/inkdrop` on macOS, `~/.config/inkdrop` on Linux, `%APPDATA%/inkdrop` on Windows)

### API Configuration

- `INKDROP_API_URL` - Inkdrop API base URL (default: `https://api.inkdrop.app`)
- `INKDROP_PACKAGES_URL` - Packages registry URL (default: `${INKDROP_API_URL}/packages`)

### Application

- `INKDROP_VERSION` - Inkdrop version to use for compatibility checks (default: `6.0.0`)

### Example

```bash
# Use custom API URL for testing
INKDROP_API_URL=http://localhost:3000 ipm search markdown

# Use custom Inkdrop home directory
INKDROP_HOME=/custom/path ipm list

# Override stored credentials temporarily
INKDROP_ACCESS_KEY_ID=your-key-id \
INKDROP_SECRET_ACCESS_KEY=your-secret-key \
ipm install my-plugin
```

## Contributing

### Prerequisites

- Node.js 24.x or higher
- npm

### Setup

```bash
git clone https://github.com/inkdropapp/ipm-cli.git
cd ipm-cli
npm install
```

### Build

```bash
npm run build
```

### Development Mode

Watch for changes and rebuild automatically:

```bash
npm run dev
```

### Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run typecheck
```

### Testing a command manually

```bash
dotenv run ./bin/cli.js <command> [options]
```

## How It Works

The CLI uses the following technologies:

- **[@inkdropapp/ipm](https://www.npmjs.com/package/@inkdropapp/ipm)** - Core package manager functionality
- **[@napi-rs/keyring](https://www.npmjs.com/package/@napi-rs/keyring)** - Secure credential storage in system keyring
- **[Commander.js](https://github.com/tj/commander.js)** - CLI framework
- **[Chalk](https://github.com/chalk/chalk)** - Terminal string styling

Authentication credentials are stored securely in your system's keyring:

- **macOS**: Keychain
- **Linux**: libsecret
- **Windows**: Credential Vault

## License

MIT

## Author

Takuya Matsuyama ([@craftzdog](https://github.com/craftzdog))

## Links

- [Inkdrop - Markdown note-taking app](https://www.inkdrop.app/)
- [Inkdrop Plugin Registry](https://my.inkdrop.app/plugins)
- [Plugin Development Guide](https://developers.inkdrop.app/guides/plugin-word-count)
- [Report Issues](https://github.com/inkdropapp/ipm-cli/issues)
