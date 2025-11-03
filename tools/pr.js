import z from 'zod'
import { commitAndPush, getLatestReleaseTag, getRepoInfo, repoIsReadyForPullRequest } from '../lib/git.js'
import { getNextVersion, getProjectInfo, updateProjectVersion } from '../lib/semver.js'
import yoctoSpinner from 'yocto-spinner'
import { ProjectInfo, NextVersion } from '../lib/types/zod.js'
import { runTests } from '../lib/run-tests.js'
import { clickableLink } from '../lib/clickable-link.js'

const PR_TYPES = ['help', 'patch', 'minor', 'major']

const toolHelp = `
  VFK Pull Request Tool

  Usage:
    vfk pr patch     Create a pull request for a patch release (bug fixes)
    vfk pr minor     Create a pull request for a minor release (new features)
    vfk pr major     Create a pull request for a major release (breaking changes)
  
  Description:
    This tool helps you create a pull request for releasing new versions of your project.
    It checks that your repository is clean and up-to-date, determines the next version
    based on semantic versioning, updates the project files, commits the changes, and
    provides a link to create the pull request on GitHub.
`

const PullRequestData = z.object({
  latestTag: z.string().nullable(),
  projectInfo: ProjectInfo.nullable(),
  nextVersion: NextVersion.nullable()
})

export const pr = async (...args) => {
  if (args.length === 0 || !PR_TYPES.includes(args[0]) || args[0] === 'help') {
    console.log(toolHelp)
    process.exit(1)
  }

  const repoInfo = getRepoInfo()
  // yocto-spinner og yocto-colors
  let spinner = yoctoSpinner({ text: 'Checking if repo is clean and up-to-date...' }).start()
  try {
    repoIsReadyForPullRequest(repoInfo)
  } catch (error) {
    spinner.error(`Repository is not ready for PR: ${error.message}`)
    process.exit(1)
  }
  spinner.success('Repository is clean and up-to-date')

  const pullRequestData = PullRequestData.parse({
    latestTag: null,
    projectInfo: null,
    nextVersion: null
  })

  spinner = yoctoSpinner({ text: 'Getting project info...' }).start()
  try {
    pullRequestData.projectInfo = getProjectInfo()
  } catch (error) {
    spinner.error(`Failed to get project info: ${error.message}`)
  }
  spinner.success(`Project version is ${pullRequestData.projectInfo.version} (${pullRequestData.projectInfo.type})`)

  // Run tests before proceeding
  spinner = yoctoSpinner({ text: 'Running tests...' }).start()
  try {
    runTests(pullRequestData.projectInfo)
  } catch (error) {
    spinner.error('Tests failed, please fix the errors before you create a PR')
    process.exit(1)
  }
  spinner.success('All tests passed')

  spinner = yoctoSpinner({ text: 'Finding latest release tag...' }).start()
  try {
    pullRequestData.latestTag = getLatestReleaseTag()
  } catch (error) {
    spinner.error(`Failed to get latest release tag: ${error.message}`)
  }
  spinner.success(pullRequestData.latestTag ? `Latest release tag is ${pullRequestData.latestTag}` : 'No release tags found, will use project version or start from 1.0.0')

  spinner = yoctoSpinner({ text: 'Determining next version...' }).start()
  try {
    pullRequestData.nextVersion = getNextVersion(pullRequestData.latestTag, pullRequestData.projectInfo, args[0])
  } catch (error) {
    spinner.error(`Failed to determine next version: ${error.message}`)
  }
  spinner.success(`Next version is ${pullRequestData.nextVersion.version} (determined from ${pullRequestData.nextVersion.source})${pullRequestData.nextVersion.isInitialRelease ? ', this is the initial release' : ''}`)

  // If project version is different than next version, update project version
  if (pullRequestData.projectInfo.version !== pullRequestData.nextVersion.version) {
    spinner = yoctoSpinner({ text: `Updating ${pullRequestData.projectInfo.type}-project version in ${pullRequestData.projectInfo.paths.join(' and ')} to ${pullRequestData.nextVersion.version}...` }).start()
    try {
      updateProjectVersion(pullRequestData.projectInfo, pullRequestData.nextVersion.version)
    } catch (error) {
      spinner.error(`Failed to update project version: ${error.message}`)
      process.exit(1)
    }
    spinner.success(`${pullRequestData.projectInfo.type}-project version in ${pullRequestData.projectInfo.paths.join(' and ')} updated to ${pullRequestData.nextVersion.version}`)

    spinner = yoctoSpinner({ text: 'Committing version update and pushing to remote' }).start()
    try {
      // Commit and push changes
      commitAndPush(`chore: bump version to ${pullRequestData.nextVersion.version}`)
    } catch (error) {
      spinner.error(`Failed to commit and push changes: ${error.message}`)
      process.exit(1)
    }
    spinner.success('Version update committed and pushed to remote')
  } else {
    spinner = yoctoSpinner({ text: `${pullRequestData.projectInfo.type}-project version in ${pullRequestData.projectInfo.paths.join(' and ')} is already up to date.` }).start().success()
  }

  // Then we create a PR from a query link to github with the right info filled in
  const prTitle = 'PLACEHOLDER CREATE YOUR OWN TITLE'
  const prBody = 'PLACEHOLDER BODY\n\n Closes (change to #{issue_number} for automatic closing of issues) (add description of closing notes here)'

  const prLink = `${repoInfo.githubUrl}/compare/${repoInfo.defaultBranch}...${repoInfo.currentBranch}?quick_pull=1&title=${encodeURIComponent(prTitle)}&body=${encodeURIComponent(prBody)}`

  console.log(`Create your PR here: ${clickableLink(prLink)}`)
}
