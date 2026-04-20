import yoctoSpinner, { type Spinner } from "yocto-spinner"
import { commitAndPush, conventionalCommitTypes, getCommitsSinceTag, getLatestReleaseTag, getRepoInfo, repoIsReadyForRelease, sortCommitsByType } from "../lib/git.js"
import { openUrl } from "../lib/open-url.js"
import { generateReleaseNotes } from "../lib/release-notes.js"
import { runTests } from "../lib/run-tests.js"
import { getNextVersion, getProjectInfo, getSemverReleaseType, SUPPORTED_SEMVER_TYPES_BY_PRIORITY, updateProjectVersion } from "../lib/semver.js"
import type { GitCommitType, RepoInfo } from "../types/git.js"
import type { NilsReleaseData, SupportedSemverType } from "../types/tools.js"

const toolHelp = `
  VFK Release Tool

  Usage:
    vfk nilsrelease patch     Create a patch release release (bug fixes) directly without a PR
    vfk nilsrelease minor     Create a minor release (new features) directly without a PR
    vfk nilsrelease major     Create a major release (breaking changes) directly without a PR
  
  Description:
    This tool helps you create a GitHub release (and git tag) for your project.
    It checks that your repository is clean and up-to-date, determines the next version
    based on semantic versioning, bumps the version, creates pretty release notes and
    provides a link to create the release on GitHub.
`

export const nilsrelease = (...args: string[]): void => {
	if (args.length === 0 || args[0] === "help" || !SUPPORTED_SEMVER_TYPES_BY_PRIORITY.includes(args[0] as SupportedSemverType)) {
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

	const releaseData: NilsReleaseData = {
		semverType: args[0] as SupportedSemverType,
		latestTag: null,
		projectInfo: null,
		releaseType: null,
		nextVersion: null,
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

		spinner.success(`Found ${releaseData.commits.length} commit(s) since latest tag ${releaseData.latestTag}`)

		spinner = yoctoSpinner({ text: "Analyzing commit types..." }).start()
		const sortedCommits = sortCommitsByType(releaseData.commits)
		if (!sortedCommits) {
			spinner.error("Sorted commits is null??? Contact idiot-developers.")
			process.exit(1)
		}

		// Determine the highest semver type present in the commits
		const commitTypesByPriority: GitCommitType[] = [...SUPPORTED_SEMVER_TYPES_BY_PRIORITY, "maintenance", "other"]

		const highestCommitType: GitCommitType | undefined = commitTypesByPriority.find((type: GitCommitType) => sortedCommits?.[type] && sortedCommits[type].length > 0)
		if (!highestCommitType) {
			spinner.error("No commit types found. Probably no commits at all, but we already checked that??? Contact idiot-developers.")
			process.exit(1)
		}

		const requestedTypeIndex: number = commitTypesByPriority.indexOf(releaseData.semverType) // Lower index means higher priority
		const highestTypeIndex: number = commitTypesByPriority.indexOf(highestCommitType)
		if (highestTypeIndex < requestedTypeIndex) {
			spinner.error(
				`The requested PR type "${releaseData.semverType}" is lower than the highest commit type "${highestCommitType}" in the branch. Please review your commits and choose a higher PR type.`
			)
			// List the commits beautifully-ish in the terminal
			console.log(`Commits by type:`)
			for (const type of commitTypesByPriority) {
				if (sortedCommits?.[type] && sortedCommits[type].length > 0) {
					console.log(`\n${type.toUpperCase()} COMMITS:`)
					for (const commit of sortedCommits[type]) {
						console.log(`- ${commit.subject} (${commit.hash})`)
					}
				}
			}
			process.exit(1)
		}

		// Check if there are commits that do not follow conventional commit types
		if (sortedCommits.other.length > 0) {
			yoctoSpinner().start().warning(`There are ${sortedCommits.other.length} commit(s) of type "other". Remember to prefix with conventional commit types for proper versioning.`)
			// List out conventional commit types
			console.log(`\t - Conventional commit types (suffix the type with : or - ) are: ${Object.values(conventionalCommitTypes).flat().join(", ")}`)
		}
	} catch (error) {
		spinner.error(`Failed to get commits: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	}

	spinner.success(`Commits validated for release type "${releaseData.semverType}"`)

	// Check if we need to update project version based on latest tag and release type, and do it if needed
	spinner = yoctoSpinner({ text: "Determining next version..." }).start()
	try {
		releaseData.nextVersion = getNextVersion(releaseData.latestTag, releaseData.projectInfo, releaseData.semverType)
	} catch (error) {
		spinner.error(`Failed to determine next version: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	}
	spinner.success(`Next version is ${releaseData.nextVersion.version} (${releaseData.nextVersion.description})${releaseData.nextVersion.isInitialRelease ? ", this is the initial release" : ""}`)

	// If project version is different from next version, update project version
	if (releaseData.projectInfo.version !== releaseData.nextVersion.version) {
		spinner = yoctoSpinner({
			text: `Updating ${releaseData.projectInfo.type}-project version in ${releaseData.projectInfo.paths.join(" and ")} to ${releaseData.nextVersion.version}...`
		}).start()
		try {
			updateProjectVersion(releaseData.projectInfo, releaseData.nextVersion.version)
		} catch (error) {
			spinner.error(`Failed to update project version: ${error instanceof Error ? error.message : String(error)}`)
			process.exit(1)
		}
		spinner.success(
			`${releaseData.projectInfo.type}-project version in ${releaseData.projectInfo.paths.join(" and ")} updated from ${releaseData.projectInfo.version} to ${releaseData.nextVersion.version}`
		)

		spinner = yoctoSpinner({
			text: "Committing version update and pushing to remote :: "
		}).start()
		try {
			// Commit and push changes
			commitAndPush(`chore: bump version to ${releaseData.nextVersion.version}`)
		} catch (error) {
			spinner.error(`Failed to commit and push changes: ${error instanceof Error ? error.message : String(error)}`)
			process.exit(1)
		}

		// Update current project version to match what we just updated/confirmed, to make sure that the correct version is used when generating release notes and the release link
		releaseData.projectInfo.version = releaseData.nextVersion.version

		// Push the latest commit to releaseData.commits so that the release notes include the commit that bumps the version
		if (!releaseData.commits) {
			spinner.error("Release data commits is null??? Contact idiot-developers.")
			process.exit(1)
		}
		const versionBumpCommit = getCommitsSinceTag(releaseData.commits[0]?.hash)[0] // Get the latest commit, which should be the version bump commit we just made
		if (!versionBumpCommit) {
			spinner.error("Could not find version bump commit in git log??? Contact idiot-developers.")
			process.exit(1)
		}
		releaseData.commits.unshift(versionBumpCommit)

		spinner.success("Version update committed and pushed to remote, local project version updated to match the new version, and version bump commit added to release data commits")
	} else {
		spinner = yoctoSpinner({
			text: `${releaseData.projectInfo.type}-project version in ${releaseData.projectInfo.paths.join(" and ")} is already up to date.`
		})
		spinner.start()
		spinner.success()
	}

	// Finn ut av hva slags semver type release vi skal lage basert på latestTag og project version
	spinner = yoctoSpinner({ text: "Determining release type (semver) based on latest release tag and next project version..." }).start()
	try {
		releaseData.releaseType = getSemverReleaseType(releaseData.latestTag, releaseData.projectInfo)
	} catch (error) {
		spinner.error(`Failed to determine semver type: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	}
	spinner.success(`Determined release type (semver) is ${releaseData.releaseType}. Release-tag will be ${releaseData.nextVersion.version}`)

	try {
		releaseData.releaseNotes = generateReleaseNotes(releaseData)
	} catch (error) {
		spinner.error(`Failed to generate release notes: ${error instanceof Error ? error.message : String(error)}`)
		process.exit(1)
	}
	spinner.success("Release notes generated")

	// Then we create a PR from a query link to GitHub with the right info filled in
	const releaseTitle = `Release ${releaseData.nextVersion.version}`
	const releaseBody: string = releaseData.releaseNotes

	const releaseLink = `${repoInfo.githubUrl}/releases/new?tag=${encodeURIComponent(releaseData.nextVersion.version)}&title=${encodeURIComponent(releaseTitle)}&body=${encodeURIComponent(releaseBody)}`

	openUrl(releaseLink, "🚀 Create your release here if it did not open automatically")
}
