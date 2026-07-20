import yoctoSpinner, { type Spinner } from "yocto-spinner"
import { getCommitsSinceTag, getLatestReleaseTag, getRepoInfo, repoIsReadyForRelease } from "../lib/git.js"
import { openUrl } from "../lib/open-url.js"
import { generateReleaseNotes } from "../lib/release-notes.js"
import { runTests } from "../lib/run-tests.js"
import { getProjectInfo, getSemverReleaseType } from "../lib/semver.js"
import type { RepoInfo } from "../types/git.js"
import type { ReleaseData } from "../types/tools.js"

const toolHelp = `
  VFK Release Tool

  Usage:
    vfk release           Create a new GitHub release (and git tag)
  
  Description:
    This tool helps you create a GitHub release (and git tag) for your project.
    It checks that your repository is clean and up-to-date, determines the next version
    based on semantic versioning, creates pretty release notes and
    provides a link to create the release on GitHub.
`

export const release = (...args: string[]): void => {
  if (args[0] === "help") {
    console.log(toolHelp)
    process.exit(1)
  }

  const repoInfo: RepoInfo = getRepoInfo()
  // yocto-spinner og yocto-colors
  let spinner: Spinner = yoctoSpinner({
    text: "Checking if repo is clean and up-to-date..."
  }).start()
  try {
    repoIsReadyForRelease(repoInfo)
  } catch (error) {
    spinner.error(`Repository is not ready for release: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  spinner.success("Repository is clean and up-to-date")

  const releaseData: ReleaseData = {
    latestTag: null,
    projectInfo: null,
    releaseType: null,
    commits: null,
    releaseNotes: null
  }

  spinner = yoctoSpinner({ text: "Getting project info..." }).start()
  try {
    releaseData.projectInfo = getProjectInfo()
  } catch (error) {
    spinner.error(`Failed to get project info: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  spinner.success(`Project version is ${releaseData.projectInfo.version} (${releaseData.projectInfo.type})`)

  // Run tests before proceeding
  spinner = yoctoSpinner({ text: "Running tests..." }).start()
  try {
    runTests(releaseData.projectInfo)
  } catch (error) {
    spinner.error(`Tests failed, please fix the errors before you create a release: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  spinner.success("All tests passed")

  spinner = yoctoSpinner({ text: "Finding latest release tag..." }).start()
  try {
    releaseData.latestTag = getLatestReleaseTag()
  } catch (error) {
    spinner.error(`Failed to get latest release tag: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  spinner.success(releaseData.latestTag ? `Latest release tag is ${releaseData.latestTag}` : "No release tags found, will use project version")

  // Get commits since latest release tag (and check that there are commits)
  spinner = yoctoSpinner({ text: releaseData.latestTag ? `Getting git log commits since latest release tag ${releaseData.latestTag}` : "No latest tag found, getting all commits" }).start()
  try {
    releaseData.commits = getCommitsSinceTag(releaseData.latestTag)
    if (releaseData.commits.length === 0) {
      spinner.error(`No commits found. Why do you want to create a release with no new changes??? 🍕`)
      process.exit(1)
    }
  } catch (error) {
    spinner.error(`Failed to get commits: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  spinner.success(`Found ${releaseData.commits.length} commit(s) since latest tag ${releaseData.latestTag}`)

  // Finn ut av hva slags semver type release vi skal lage basert på latestTag og project version
  spinner = yoctoSpinner({ text: "Determining release type (semver) based on latest release tag and current project version..." }).start()
  try {
    releaseData.releaseType = getSemverReleaseType(releaseData.latestTag, releaseData.projectInfo)
  } catch (error) {
    spinner.error(`Failed to determine semver type: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  spinner.success(`Determined release type (semver) is ${releaseData.releaseType}. Release-tag will be ${releaseData.projectInfo.version}`)

  try {
    releaseData.releaseNotes = generateReleaseNotes(releaseData)
  } catch (error) {
    spinner.error(`Failed to generate release notes: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  spinner.success("Release notes generated")

  // Then we create a PR from a query link to GitHub with the right info filled in
  const releaseTitle = `Release ${releaseData.projectInfo.version}`
  const releaseBody: string = releaseData.releaseNotes

  const releaseLink = `${repoInfo.githubUrl}/releases/new?tag=${encodeURIComponent(releaseData.projectInfo.version)}&title=${encodeURIComponent(releaseTitle)}&body=${encodeURIComponent(releaseBody)}`

  openUrl(releaseLink, "🚀 Create your release here if it did not open automatically")
}
