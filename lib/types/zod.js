import z from "zod"

/** @typedef { z.infer<typeof ProjectInfo> } ProjectInfo */
export const ProjectInfo = z.object({
	version: z.string().nullable(),
	type: z.enum(["node", "dotnet"]),
	paths: z.array(z.string())
})

/** @typedef { z.infer<typeof NextVersion> } NextVersion */
export const NextVersion = z.object({
	version: z.string(),
	isInitialRelease: z.boolean(),
	source: z.enum(["tag", "project", "project-already-bumped", "vfk-cli"]),
	description: z.string()
})

/** @typedef { z.infer<typeof RepoInfo> } RepoInfo */
export const RepoInfo = z.object({
	remoteUrl: z.string(),
	githubUrl: z.url(),
	currentBranch: z.string(),
	defaultBranch: z.string(),
	repoIsClean: z.boolean(),
	commitDiff: z.object({
		behind: z.number(),
		ahead: z.number()
	})
})

/** @typedef { z.infer<typeof GitLogCommit> } GitLogCommit */
export const GitLogCommit = z.object({
	hash: z.string(),
	authorName: z.string(),
	authorEmail: z.string().email(),
	subject: z.string(),
	body: z.string(),
	commitDate: z.string()
})

/** @typedef { z.infer<typeof GitLogCommits> } GitLogCommits */
export const GitLogCommits = z.array(GitLogCommit)

/** @typedef {z.infer<typeof SortedCommits>} */
export const SortedCommits = z.object({
	major: GitLogCommits,
	minor: GitLogCommits,
	patch: GitLogCommits,
	maintenance: GitLogCommits,
	other: GitLogCommits
})

/** @typedef {z.infer<typeof ReleaseTypes>} ReleaseTypes */
export const ReleaseTypes = z.enum(["major", "minor", "patch", "initial-release"])
