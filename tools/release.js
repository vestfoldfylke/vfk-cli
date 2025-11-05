import yoctoSpinner from "yocto-spinner"
import z from "zod"
import { clickableLink } from "../lib/clickable-link.js"
import { getCommitsSinceTag, getLatestReleaseTag, getRepoInfo, repoIsReadyForRelease } from "../lib/git.js"
import { generateReleaseNotes } from "../lib/release-notes.js"
import { runTests } from "../lib/run-tests.js"
import { getProjectInfo, getSemverReleaseType } from "../lib/semver.js"
import { GitLogCommits, ProjectInfo, ReleaseTypes } from "../lib/types/zod.js"

const toolHelp = `
  VFK Release Tool

  Usage:
    vfk release           Create a new GitHub release (and git tag)
    vfk rel               Same as 'vfk release'
  
  Description:
    This tool helps you create a GitHub release (and git tag) for your project.
    It checks that your repository is clean and up-to-date, determines the next version
    based on semantic versioning, creates pretty release notes and
    provides a link to create the release on GitHub.
`

/** @typedef {z.infer<typeof ReleaseData>} ReleaseData */
const ReleaseData = z.object({
	latestTag: z.string().nullable(),
	projectInfo: ProjectInfo.nullable(),
	semverType: ReleaseTypes.nullable(),
	commits: GitLogCommits.nullable(),
	releaseNotes: z.string().nullable()
})

export const release = async (...args) => {
	if (args[0] === "help") {
		console.log(toolHelp)
		process.exit(1)
	}

	const repoInfo = getRepoInfo()
	// yocto-spinner og yocto-colors
	let spinner = yoctoSpinner({
		text: "Checking if repo is clean and up-to-date..."
	}).start()
	try {
		repoIsReadyForRelease(repoInfo)
	} catch (error) {
		spinner.error(`Repository is not ready for release: ${error.message}`)
		process.exit(1)
	}
	spinner.success("Repository is clean and up-to-date")

	/** @type {ReleaseData} */
	const releaseData = ReleaseData.parse({
		latestTag: null,
		projectInfo: null,
		semverType: null,
		nextVersion: null,
		commits: null,
		releaseNotes: null
	})

	spinner = yoctoSpinner({ text: "Getting project info..." }).start()
	try {
		releaseData.projectInfo = getProjectInfo()
	} catch (error) {
		spinner.error(`Failed to get project info: ${error.message}`)
	}
	spinner.success(`Project version is ${releaseData.projectInfo.version} (${releaseData.projectInfo.type})`)

	// Run tests before proceeding
	spinner = yoctoSpinner({ text: "Running tests..." }).start()
	try {
		runTests(releaseData.projectInfo)
	} catch (error) {
		spinner.error(`Tests failed, please fix the errors before you create a release: ${error.message}`)
		process.exit(1)
	}
	spinner.success("All tests passed")

	spinner = yoctoSpinner({ text: "Finding latest release tag..." }).start()
	try {
		releaseData.latestTag = getLatestReleaseTag()
	} catch (error) {
		spinner.error(`Failed to get latest release tag: ${error.message}`)
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
		spinner.error(`Failed to get commits since latest tag: ${error.message}`)
		process.exit(1)
	}
	spinner.success(`Found ${releaseData.commits.length} commit(s) since latest tag ${releaseData.latestTag}`)

	// Finn ut av hva slags semver type release vi skal lage basert på latestTag og project version
	spinner = yoctoSpinner({ text: "Determining semver type based on latest release tag and current project version..." }).start()
	try {
		releaseData.semverType = getSemverReleaseType(releaseData.latestTag, releaseData.projectInfo)
	} catch (error) {
		spinner.error(`Failed to determine semver type: ${error.message}`)
		process.exit(1)
	}
	spinner.success(`Determined semver type is ${releaseData.semverType}. Release-tag will be ${releaseData.projectInfo.version}`)

	try {
		releaseData.releaseNotes = generateReleaseNotes(releaseData)
	} catch (error) {
		spinner.error(`Failed to generate release notes: ${error.message}`)
		process.exit(1)
	}
	spinner.success("Release notes generated")

	// Then we create a PR from a query link to github with the right info filled in
	const releaseTitle = `Release ${releaseData.projectInfo.version}`
	const releaseBody = releaseData.releaseNotes

	const releaseLink = `${repoInfo.githubUrl}/releases/new?tag=${encodeURIComponent(releaseData.projectInfo.version)}&title=${encodeURIComponent(releaseTitle)}&body=${encodeURIComponent(releaseBody)}`

	console.log(`Create your release here: ${clickableLink(releaseLink)}`)
}
