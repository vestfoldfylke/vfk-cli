import type { GitLogCommit, SortedCommits } from "./git.js"
import type { NextVersion, ProjectInfo, ReleaseType } from "./semver.js"

export type SupportedSemverType = "major" | "minor" | "patch"

export type PullRequestData = {
  semverType: SupportedSemverType
  latestTag: string | null
  projectInfo: ProjectInfo | null
  nextVersion: NextVersion | null
  sortedCommits: SortedCommits | null
}

export type ReleaseData = {
  latestTag: string | null
  projectInfo: ProjectInfo | null
  releaseType: ReleaseType | null
  commits: GitLogCommit[] | null
  releaseNotes: string | null
}

export type NilsReleaseData = {
  semverType: SupportedSemverType
  latestTag: string | null
  projectInfo: ProjectInfo | null
  releaseType: ReleaseType | null
  nextVersion: NextVersion | null
  commits: GitLogCommit[] | null
  releaseNotes: string | null
}
