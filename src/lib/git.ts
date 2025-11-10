import { execSync } from "node:child_process"
import type { GitLogCommit, RepoInfo, SortedCommits } from "../types/git.js"
import { getLatestSemverTag } from "./semver.js"

const runGitCommand = (command: string) => {
	if (typeof command !== "string" || !command.startsWith("git ")) {
		throw new Error("Command must be string and only git commands are allowed")
	}
	try {
		const res = execSync(command)
		return res.toString()
	} catch (err) {
		if (err instanceof Error && err.message.includes("Not a git repository")) {
			throw new Error("Directory is not a Git repository")
		}
		throw err
	}
}

const getGithubUsername = (): string | undefined => {
	try {
		return runGitCommand("git config --get github.user")?.trim() ?? runGitCommand("git config --global --get github.user")?.trim() ?? undefined
	} catch {
		return undefined
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

export const getCommitsBehindAndAheadDefaultBranch = () => {
	const defaultBranch = getDefaultBranch()
	const diff = runGitCommand(`git rev-list --left-right --count origin/${defaultBranch}...HEAD`).trim()
	const [behind, ahead] = diff.split("\t")
	if (!behind || !ahead) {
		throw new Error("Could not determine commit difference between current branch and default branch")
	}
	return { behind: parseInt(behind, 10), ahead: parseInt(ahead, 10) }
}

export const getLatestReleaseTag = () => {
	const tags = runGitCommand("git tag").trim().split("\n")
	return getLatestSemverTag(tags)
}

export const repoIsReadyForPullRequest = (repoInfo: RepoInfo) => {
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

export const repoIsReadyForRelease = (repoInfo: RepoInfo) => {
	if (repoInfo.currentBranch !== repoInfo.defaultBranch) {
		throw new Error(`You are currently on branch ${repoInfo.currentBranch}. Please switch to the default branch (${repoInfo.defaultBranch}) to create a release.`)
	}
	if (!repoInfo.repoIsClean) {
		throw new Error("Please pull, commit and push, stash, or branch out your changes before creating a release.")
	}
}

export const getRepoInfo = (): RepoInfo => {
	const remoteUrl = runGitCommand("git config --get remote.origin.url").trim()
	if (!(remoteUrl.startsWith("git@github.com:") || remoteUrl.startsWith("https://github.com/"))) {
		throw new Error("Repository is not a GitHub repository. VFK CLI only supports GitHub for PR creation.")
	}
	fetchChangesAndTags()
	const githubUrl = (remoteUrl.startsWith("git@") ? remoteUrl.replace("git@github.com:", "https://github.com/") : remoteUrl).replace(/\.git$/, "")
	// git@github.com:<owner>/<repo>.git - SSH version
	// https://github.com/<owner>/<repo>.git - HTTPS version
	const githubUsername = getGithubUsername()
	const currentBranch = getCurrentBranch()
	const defaultBranch = getDefaultBranch()
	const repoIsClean = isRepoClean()
	const commitDiff = getCommitsBehindAndAheadDefaultBranch()

	return {
		remoteUrl,
		githubUrl,
		githubUsername,
		currentBranch,
		defaultBranch,
		repoIsClean,
		commitDiff
	}
}

export const commitAndPush = (message: string) => {
	runGitCommand("git add .")
	runGitCommand(`git commit -m "${message}"`)
	const currentBranch = getCurrentBranch()
	runGitCommand(`git push origin ${currentBranch} --quiet`)
}

const commitSeparator = "%x00ENDOFCOMMIT%x00" // Nul-character as separator, as it is not allowed in commit messages
const prettyFormat = `%h%x00%an%x00%ae%x00%s%x00%b%x00%ad${commitSeparator}`

const prettyPropertyNamesInOrder = ["hash", "authorName", "authorEmail", "subject", "body", "commitDate"]
const commitOutputSeparator = "\x00ENDOFCOMMIT\x00\n" // add newline after commit separator to also remove the newlines after each new commit line from git log
const commitPropertySeparator = "\x00"

export const parseGitLogs = (rawLog: string): GitLogCommit[] => {
	const commitEntries = rawLog.split(commitOutputSeparator).filter((entry) => entry.trim() !== "")

	return commitEntries.map((entry) => {
		const properties = entry.split(commitPropertySeparator)
		if (properties.length < prettyPropertyNamesInOrder.length) {
			throw new Error("Pretty format and property names length mismatch, check prettyFormat and property names array (that they have same number of properties, and in same order)")
		}
		const commit = {
			hash: properties[0] as string,
			authorName: properties[1] as string,
			authorEmail: properties[2] as string,
			subject: properties[3] as string,
			body: properties[4] as string,
			commitDate: properties[5] as string
		}
		return commit
	})
}

export const getCommitsSinceTag = (tagOrCommitHash: string | null | undefined): GitLogCommit[] => {
	const log = tagOrCommitHash
		? runGitCommand(`git log --pretty=format:'${prettyFormat}' ${tagOrCommitHash}..HEAD --date=iso-strict`).trim()
		: runGitCommand(`git log --pretty=format:'${prettyFormat}' --date=iso-strict`).trim()
	if (!log) {
		return []
	}
	return parseGitLogs(log)
}

export const getBranchSpecificCommits = (branchName: string): GitLogCommit[] => {
	const defaultBranch = getDefaultBranch()
	const log = runGitCommand(`git log --pretty=format:'${prettyFormat}' origin/${defaultBranch}..${branchName} --date=iso-strict`).trim()
	if (!log) {
		return []
	}
	return parseGitLogs(log)
}

/**
 * Maps semantic versioning release types to arrays of conventional commit keywords.
 */
type ConventionalCommitTypes = {
	major: string[]
	minor: string[]
	patch: string[]
	maintenance: string[]
}

export const conventionalCommitTypes: ConventionalCommitTypes = {
	major: ["breaking change", "breaking", "major", "feat!", "fix!"],
	minor: ["feat", "minor"],
	patch: ["fix", "perf", "patch"],
	maintenance: ["test", "style", "docs", "chore", "refactor"]
}

const getCommitType = (message: string): "major" | "minor" | "patch" | "maintenance" | "other" => {
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

export const sortCommitsByType = (commits: GitLogCommit[]): SortedCommits => {
	const sorted: SortedCommits = {
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
	for (const key of Object.keys(sorted) as (keyof SortedCommits)[]) {
		sorted[key] = sorted[key].sort((a, b) => b.commitDate.localeCompare(a.commitDate))
	}
	return sorted
}
