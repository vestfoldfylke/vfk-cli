# vfk-cli
A command line interface for our pleasure

vfk-cli will help you create a beautiful pull request and release based on conventional commits.<br />
Conventional commits are commits that follow the [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/).

Supported conventional commit types:
- Maintenance (🛠): test, style, docs, chore, refactor
- Patch (🐛): fix, perf, patch
- Minor (✨): feat, minor
- Major (🚨): breaking change, breaking, major, feat!, fix!

If a commit does not start with one of the supported conventional commit types, it will be put under `Other commits` section in the changelog.

Supported project types:
- Node.js (package.json, package-lock.json)
- dotnet (*.csproj first one with <Version> tag)

## vfk pr [patch|minor|major]

Create a pull request with a version bump and changelog based on conventional commits since last release.<br />
If no previous release is found, it will create an initial release with version 1.0.0.

Steps performed:
- Check current branch is NOT default branch and that current branch is up-to-date with origin and has no uncommitted changes
- Determine and get project information (supports Node.js and dotnet projects)
- Run tests to ensure code is working before creating PR
- Get and analyze commits since last release tag (if no tag found, will create initial release)
  - If no commits found, will exit with error message
  - If chosen pr type is lower than the highest type found in commits, will exit with error message
- Find latest version tag
- Determining new version based on chosen pr type, commits found and latest version tag
- Bump project version file(s)
  - Node.js: package.json, package-lock.json
  - dotnet: *.csproj (the first one found that contains a <Version> tag)
- Commit version bump and push to origin
- Generate changelog based on commits found
- Create pull request link with title and description (changelog)

### Usage
```bash
vfk pr patch
vfk pr minor
vfk pr major
```

## vfk release

Create a release with changelog based on conventional commits since last release.<br />
Will create a release draft on GitHub with changelog and tag the release commit.

Steps performed:
- Check current branch is default branch and that current branch is up-to-date with origin and has no uncommitted changes
- Run tests to ensure code is working before creating release
- Find latest version tag
- Get and analyze commits since last release tag (if no tag found, will create initial release)
    - If no commits found, will exit with error message
- Determining new version based on latest version tag and project version
- Generate release notes based on commits found
- Create release draft link with title, description (release notes) and tag

### Usage
```bash
vfk release
vfk rel
```

## Development
- Clone or fork repo
- `npm i``
- `npm link` This will make the `vfk` command point to your local project (uninstall @vestfoldfylke/vfk-cli first, if it does not work)
- Test usage on some dummy repo from GitHub
- Remember `npm run build` before testing the cli when you have made changes