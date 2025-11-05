import { execSync } from "node:child_process"
import { getLatestSemverTag } from "./semver.js"
import { GitLogCommits, RepoInfo } from "./types/zod.js"

const runGitCommand = (command) => {
	if (typeof command !== "string" || !command.startsWith("git ")) {
		throw new Error("Command must be string and only git commands are allowed")
	}
	try {
		const res = execSync(command)
		return res.toString()
	} catch (err) {
		if (err.message.includes("Not a git repository")) {
			throw new Error("Directory is not a Git repository")
		}
		throw err
	}
}

export const getDefaultBranch = () => {
	return runGitCommand("git rev-parse --abbrev-ref origin/HEAD").trim().replace("origin/", "")
}

export const getCurrentBranch = () => {
	return runGitCommand("git rev-parse --abbrev-ref HEAD").trim()
}

export const fetchChangesAndTags = () => {
	return runGitCommand("git fetch --all --tags --quiet")
}

export const isRepoClean = () => {
	const status = runGitCommand("git status")
	return status.includes("Your branch is up to date with ") && status.includes("nothing to commit, working tree clean")
}

export const isGithubRepo = () => {
	const remoteUrl = runGitCommand("git config --get remote.origin.url").trim()
	// git@github.com:<owner>/<repo>.git - SSH version
	// https://github.com/<owner>/<repo>.git - HTTPS version
	return remoteUrl.startsWith("git@github.com:") || remoteUrl.startsWith("https://github.com/")
}

export const getCommitsBehindAndAheadDefaultBranch = () => {
	const defaultBranch = getDefaultBranch()
	const diff = runGitCommand(`git rev-list --left-right --count origin/${defaultBranch}...HEAD`).trim()
	const [behind, ahead] = diff.split("\t")
	return { behind: parseInt(behind, 10), ahead: parseInt(ahead, 10) }
}

export const getLatestReleaseTag = () => {
	const tags = runGitCommand("git tag").trim().split("\n")
	// Lets find the latest semver tag
	return getLatestSemverTag(tags)
}

/**
 *
 * @param {RepoInfo} repoInfo
 * @returns {void}
 */
export const repoIsReadyForPullRequest = (repoInfo) => {
	repoInfo = RepoInfo.parse(repoInfo)
	if (repoInfo.currentBranch === repoInfo.defaultBranch) {
		throw new Error("You are currently on the default branch. Please switch to a feature branch to create a PR.")
	}
	if (repoInfo.commitDiff.behind > 0) {
		throw new Error(
			`Your branch is behind the default branch by ${repoInfo.commitDiff.behind} commit(s). Please merge the default branch (git merge origin/${repoInfo.defaultBranch}) into your branch before creating a PR.`
		)
	}
	if (!repoInfo.repoIsClean) {
		throw new Error("Please pull, commit and push, or stash your changes before creating a PR.")
	}
}

/**
 * Simply throws errors if repo is not clean and up to date, or not on default branch
 * @param {RepoInfo} repoInfo
 * @returns {void}
 */
export const repoIsReadyForRelease = (repoInfo) => {
	repoInfo = RepoInfo.parse(repoInfo)
	if (repoInfo.currentBranch !== repoInfo.defaultBranch) {
		throw new Error(`You are currently on branch ${repoInfo.currentBranch}. Please switch to the default branch (${repoInfo.defaultBranch}) to create a release.`)
	}
	if (!repoInfo.repoIsClean) {
		throw new Error("Please pull, commit and push, stash, or branch out your changes before creating a release.")
	}
}

/**
 *
 * @returns {RepoInfo}
 */
export const getRepoInfo = () => {
	const remoteUrl = runGitCommand("git config --get remote.origin.url").trim()
	if (!(remoteUrl.startsWith("git@github.com:") || remoteUrl.startsWith("https://github.com/"))) {
		throw new Error("Repository is not a GitHub repository. VFK CLI only supports GitHub for PR creation.")
	}
	fetchChangesAndTags()
	const githubUrl = (remoteUrl.startsWith("git@") ? remoteUrl.replace("git@github.com:", "https://github.com/") : remoteUrl).replace(/\.git$/, "")
	// git@github.com:<owner>/<repo>.git - SSH version
	// https://github.com/<owner>/<repo>.git - HTTPS version
	const currentBranch = getCurrentBranch()
	const defaultBranch = getDefaultBranch()
	const repoIsClean = isRepoClean()
	const commitDiff = getCommitsBehindAndAheadDefaultBranch()

	return {
		remoteUrl,
		githubUrl,
		currentBranch,
		defaultBranch,
		repoIsClean,
		commitDiff
	}
}

export const commitAndPush = (message) => {
	runGitCommand("git add .")
	runGitCommand(`git commit -m "${message}"`)
	const currentBranch = getCurrentBranch()
	runGitCommand(`git push origin ${currentBranch} --quiet`)
}

/**
 *
 * @param {string} rawLog
 * @param {string} commitSeparator
 * @param {string} propertySeparator
 * @param {string[]} propertyNamesInOrder
 * @returns {Array<Object>}
 */
export const parseGitLogs = (rawLog, commitSeparator, propertySeparator, propertyNamesInOrder) => {
	const entries = rawLog.split(commitSeparator).filter((entry) => entry.trim() !== "")

	const commits = entries.map((entry) => {
		const properties = entry.split(propertySeparator)
		if (properties.length < propertyNamesInOrder.length) {
			throw new Error("You are asking for more properties than available in git log output... check the separators or your code?")
		}
		const commit = {}
		propertyNamesInOrder.forEach((propName, index) => {
			commit[propName] = properties[index]
		})
		return commit
	})
	return commits
}

/**
 * If tagOrCommitHash is null or undefined, gets all commits
 * @param {?string} [tagOrCommitHash]
 */
export const getCommitsSinceTag = (tagOrCommitHash) => {
	const commitSeparator = "%x00ENDOFCOMMIT%x00" // Nul-character as separator, as it is not allowed in commit messages
	const prettyFormat = `%h%x00%an%x00%ae%x00%s%x00%b%x00%ad${commitSeparator}`

	// Git log gir deg det som ligger i branchen du er i (tror vi)

	const log = tagOrCommitHash
		? runGitCommand(`git log --pretty=format:'${prettyFormat}' ${tagOrCommitHash}..HEAD --date=iso-strict`).trim()
		: runGitCommand(`git log --pretty=format:'${prettyFormat}' --date=iso-strict`).trim()
	if (!log) {
		return []
	}
	// add newline after commit separator to also remove the newlines after each new commit line from git log
	const commitOutputSeparator = "\x00ENDOFCOMMIT\x00\n"
	return GitLogCommits.parse(parseGitLogs(log, commitOutputSeparator, "\x00", ["hash", "authorName", "authorEmail", "subject", "body", "commitDate"]))
}

export const getBranchSpecificCommits = (branchName) => {
	const commitSeparator = "%x00ENDOFCOMMIT%x00" // Nul-character as separator, as it is not allowed in commit messages
	const prettyFormat = `%h%x00%an%x00%ae%x00%s%x00%b%x00%ad${commitSeparator}`

	// REMEMBER TO USE ORIGIN/MAIN when comparing to default branch
	// Get all commits in current branch that are not in default branch
	const defaultBranch = getDefaultBranch()
	const log = runGitCommand(`git log --pretty=format:'${prettyFormat}' origin/${defaultBranch}..${branchName} --date=iso-strict`).trim()
	if (!log) {
		return []
	}
	// add newline after commit separator to also remove the newlines after each new commit line from git log
	const commitOutputSeparator = "\x00ENDOFCOMMIT\x00\n"
	return GitLogCommits.parse(parseGitLogs(log, commitOutputSeparator, "\x00", ["hash", "authorName", "authorEmail", "subject", "body", "commitDate"]))
}

/**
 * Maps semantic versioning release types to arrays of conventional commit keywords.
 *
 * @typedef {Object} ConventionalCommitTypes
 * @property {string[]} major - Keywords indicating a major release (breaking changes).
 * @property {string[]} minor - Keywords indicating a minor release (new features, non-breaking).
 * @property {string[]} patch - Keywords indicating a patch release (bug fixes, performance improvements).
 * @property {string[]} maintenance - Keywords for maintenance tasks (tests, style, docs, chores, refactoring).
 *
 */

/** @type {ConventionalCommitTypes} */
export const conventionalCommitTypes = {
	major: ["breaking change", "breaking", "major", "feat!", "fix!"],
	minor: ["feat", "minor"],
	patch: ["fix", "perf", "patch"],
	maintenance: ["test", "style", "docs", "chore", "refactor"]
}

/**
 * @param {string} message
 * @returns {'major' | 'minor' | 'patch' | 'maintenance' | 'other'}
 */
const getCommitType = (message) => {
	message = message.trim().toLowerCase()
	for (const [type, keywords] of Object.entries(conventionalCommitTypes)) {
		for (const keyword of keywords) {
			// Check for keyword at the start or after type(scope)
			const regex = new RegExp(`^${keyword}(\\(.+\\))?(!)?(:| -|$)`, "i")
			if (regex.test(message)) {
				// @ts-expect-error DET ER OK
				return type
			}
		}
	}
	return "other"
}

/**
 * @typedef {Object} SortedCommits
 * @property {Array<import('./types/zod.js').GitLogCommit>} major
 * @property {Array<import('./types/zod.js').GitLogCommit>} minor
 * @property {Array<import('./types/zod.js').GitLogCommit>} patch
 * @property {Array<import('./types/zod.js').GitLogCommit>} maintenance
 * @property {Array<import('./types/zod.js').GitLogCommit>} other
 */

/**
 * Sorts commits by type (patch, minor, major, maintenance, other0), and date descending within each type
 * @param {import('./types/zod.js').GitLogCommits} commits
 * @returns {SortedCommits}
 */
export const sortCommitsByType = (commits) => {
	const sorted = {
		major: [],
		minor: [],
		patch: [],
		maintenance: [],
		other: []
	}
	for (const commit of commits) {
		const type = getCommitType(commit.subject)
		sorted[type].push(commit)
	}
	// Sort all arrays by commit date descending
	for (const key of Object.keys(sorted)) {
		sorted[key] = sorted[key].sort((a, b) => b.commitDate.localeCompare(a.commitDate))
	}
	return sorted
}
