import yoctoSpinner from "yocto-spinner"
import z from "zod"
import { clickableLink } from "../lib/clickable-link.js"
import { commitAndPush, conventionalCommitTypes, getBranchSpecificCommits, getLatestReleaseTag, getRepoInfo, repoIsReadyForPullRequest, sortCommitsByType } from "../lib/git.js"
import { runTests } from "../lib/run-tests.js"
import { getNextVersion, getProjectInfo, updateProjectVersion } from "../lib/semver.js"
import { NextVersion, ProjectInfo } from "../lib/types/zod.js"

const PR_TYPES_BY_PRIORITY = ["major", "minor", "patch"]

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

/** @typedef {z.infer<typeof PullRequestData>} PullRequestData */
const PullRequestData = z.object({
	semverType: z.enum(["major", "minor", "patch"]),
	latestTag: z.string().nullable(),
	projectInfo: ProjectInfo.nullable(),
	nextVersion: NextVersion.nullable()
})

export const pr = async (...args) => {
	if (args.length === 0 || args[0] === "help" || !PR_TYPES_BY_PRIORITY.includes(args[0])) {
		console.log(toolHelp)
		process.exit(1)
	}

  /** @type {import("../lib/types").RepoInfo} */
	const repoInfo = getRepoInfo()
	// yocto-spinner og yocto-colors
	let spinner = yoctoSpinner({
		text: "Checking if repo is clean and up-to-date..."
	}).start()
	try {
		repoIsReadyForPullRequest(repoInfo)
	} catch (error) {
		spinner.error(`Repository is not ready for PR: ${error.message}`)
		process.exit(1)
	}
	spinner.success("Repository is clean and up-to-date")

	/** @type {import("../lib/types").PullRequestData} */
	const pullRequestData = PullRequestData.parse({
		semverType: args[0],
		latestTag: null,
		projectInfo: null,
		nextVersion: null
	})

	spinner = yoctoSpinner({ text: "Getting project info..." }).start()
	try {
		pullRequestData.projectInfo = getProjectInfo()
	} catch (error) {
		spinner.error(`Failed to get project info: ${error.message}`)
	}
	spinner.success(`Project version is ${pullRequestData.projectInfo.version} (${pullRequestData.projectInfo.type})`)

	// Run tests before proceeding
	spinner = yoctoSpinner({ text: "Running tests..." }).start()
	try {
		runTests(pullRequestData.projectInfo)
	} catch (error) {
		spinner.error(`Tests failed, please fix the errors before you create a PR: ${error.message}`)
		process.exit(1)
	}
	spinner.success("All tests passed")

	// Get commits in current branch not in main/default branch - check that there are commits, and if semverType is present, check that it is not lower than the commit types
	spinner = yoctoSpinner({ text: `Getting commits in branch ${repoInfo.currentBranch} not in ${repoInfo.defaultBranch}...` }).start()
	try {
		const commitsInCurrentBranch = getBranchSpecificCommits(repoInfo.currentBranch)
		if (commitsInCurrentBranch.length === 0) {
			spinner.error(`No commits found in branch ${repoInfo.currentBranch} that are not in ${repoInfo.defaultBranch}. Why do you want to create a PR with no new changes??? 🍕`)
			process.exit(1)
		}
		spinner.success(`Found ${commitsInCurrentBranch.length} commits in branch ${repoInfo.currentBranch} not in ${repoInfo.defaultBranch}`)

		spinner = yoctoSpinner({ text: "Analyzing commit types..." }).start()
		const commitsSortedByType = sortCommitsByType(commitsInCurrentBranch)

		// Determine the highest semver type present in the commits
		const commitTypesByPriority = [...PR_TYPES_BY_PRIORITY, "maintenance", "other"]
		const highestCommitType = commitTypesByPriority.find((type) => commitsSortedByType[type] && commitsSortedByType[type].length > 0)

		const requestedTypeIndex = commitTypesByPriority.indexOf(pullRequestData.semverType) // Lower index means higher priority
		const highestTypeIndex = commitTypesByPriority.indexOf(highestCommitType)
		if (highestTypeIndex < requestedTypeIndex) {
			spinner.error(
				`The requested PR type "${pullRequestData.semverType}" is lower than the highest commit type "${highestCommitType}" in the branch. Please review your commits and choose a higher PR type.`
			)
			// List the commits beautifully-ish in the terminal
			console.log(`Commits by type:`)
			for (const type of commitTypesByPriority) {
				if (commitsSortedByType[type] && commitsSortedByType[type].length > 0) {
					console.log(`\n${type.toUpperCase()} COMMITS:`)
					for (const commit of commitsSortedByType[type]) {
						console.log(`- ${commit.subject} (${commit.hash})`)
					}
				}
			}
			process.exit(1)
		}
		// Check if there are commits that do not follow conventional commit types
		if (commitsSortedByType.other.length > 0) {
			yoctoSpinner().start().warning(`There are ${commitsSortedByType.other.length} commit(s) of type "other". Remember to prefix with conventional commit types for proper versioning.`)
			// List out conventional commit types
			console.log(`\t - Conventional commit types (suffix the type with : or - ) are: ${Object.values(conventionalCommitTypes).flat().join(", ")}`)
		}
	} catch (error) {
		spinner.error(`Failed to get commits: ${error.message}`)
		process.exit(1)
	}
	spinner.success(`Commits validated for PR type "${pullRequestData.semverType}"`)

	spinner = yoctoSpinner({ text: "Finding latest release tag..." }).start()
	try {
		pullRequestData.latestTag = getLatestReleaseTag()
	} catch (error) {
		spinner.error(`Failed to get latest release tag: ${error.message}`)
	}
	spinner.success(pullRequestData.latestTag ? `Latest release tag is ${pullRequestData.latestTag}` : "No release tags found, will use project version or start from 1.0.0")

	spinner = yoctoSpinner({ text: "Determining next version..." }).start()
	try {
		pullRequestData.nextVersion = getNextVersion(pullRequestData.latestTag, pullRequestData.projectInfo, pullRequestData.semverType)
	} catch (error) {
		spinner.error(`Failed to determine next version: ${error.message}`)
	}
	spinner.success(
		`Next version is ${pullRequestData.nextVersion.version} (${pullRequestData.nextVersion.description})${pullRequestData.nextVersion.isInitialRelease ? ", this is the initial release" : ""}`
	)

	// If project version is different from next version, update project version
	if (pullRequestData.projectInfo.version !== pullRequestData.nextVersion.version) {
		spinner = yoctoSpinner({
			text: `Updating ${pullRequestData.projectInfo.type}-project version in ${pullRequestData.projectInfo.paths.join(" and ")} to ${pullRequestData.nextVersion.version}...`
		}).start()
		try {
			updateProjectVersion(pullRequestData.projectInfo, pullRequestData.nextVersion.version)
		} catch (error) {
			spinner.error(`Failed to update project version: ${error.message}`)
			process.exit(1)
		}
		spinner.success(`${pullRequestData.projectInfo.type}-project version in ${pullRequestData.projectInfo.paths.join(" and ")} updated to ${pullRequestData.nextVersion.version}`)

		spinner = yoctoSpinner({
			text: "Committing version update and pushing to remote"
		}).start()
		try {
			// Commit and push changes
			commitAndPush(`chore: bump version to ${pullRequestData.nextVersion.version}`)
		} catch (error) {
			spinner.error(`Failed to commit and push changes: ${error.message}`)
			process.exit(1)
		}
		spinner.success("Version update committed and pushed to remote")
	} else {
		spinner = yoctoSpinner({
			text: `${pullRequestData.projectInfo.type}-project version in ${pullRequestData.projectInfo.paths.join(" and ")} is already up to date.`
		})
		spinner.start()
		spinner.success()
	}

	// Then we create a PR from a query link to GitHub with the right info filled in
	const prTitle = `${pullRequestData.semverType}: ${pullRequestData.nextVersion.version} - ${repoInfo.currentBranch}`
	const prBody = "PLACEHOLDER BODY\n\n Closes (change to #{issue_number} for automatic closing of issues) (add description of closing notes here)"

	const prLink = `${repoInfo.githubUrl}/compare/${repoInfo.defaultBranch}...${encodeURIComponent(repoInfo.currentBranch)}?quick_pull=1&title=${encodeURIComponent(prTitle)}&body=${encodeURIComponent(prBody)}`

	console.log(`Create your PR here: ${clickableLink(prLink)}`)
}
