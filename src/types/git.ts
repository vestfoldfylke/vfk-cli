export type RepoInfo = {
  remoteUrl: string
  githubUrl: string
  githubUsername?: string | undefined
  currentBranch: string
  defaultBranch: string
  repoIsClean: boolean
  commitDiff: {
    behind: number
    ahead: number
  }
}

export type GitLogCommit = {
  hash: string
  authorName: string
  authorEmail: string
  subject: string
  body: string
  commitDate: string
}

export type GitCommitType = "major" | "minor" | "patch" | "maintenance" | "other"

export type SortedCommits = {
  [K in GitCommitType]: GitLogCommit[]
}
