import type { SortedCommits } from "../types/git.js"
import type { ReleaseData } from "../types/tools.js"
import { sortCommitsByType } from "./git.js"

const capitalize = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()

type EmojisByType = {
  [key in keyof SortedCommits]: string
}

const emojisByType: EmojisByType = {
  major: "🚨",
  minor: "✨",
  patch: "🐛",
  maintenance: "🛠️",
  other: "🤦‍♂️"
}

export const generateCommitNotes = (sortedCommits: SortedCommits): string => {
  let notes: string = ""
  // Loop through each commit type and add to notes
  for (const [type, commits] of Object.entries(sortedCommits) as [keyof SortedCommits, SortedCommits[keyof SortedCommits]][]) {
    if (commits.length === 0) {
      continue
    }

    notes += `### ${emojisByType[type]} **${capitalize(type)} Changes:**\n\n`
    for (const commit of commits) {
      notes += `- ${commit.subject} (${commit.hash})\n`
    }
    notes += "\n"
  }
  return notes.trim()
}

/**
 * Generates release notes based on the provided release data.
 */
export const generateReleaseNotes = (releaseData: ReleaseData): string => {
  if (!releaseData.releaseType || !releaseData.projectInfo) {
    throw new Error("releaseType and projectInfo are required to generate release notes")
  }
  if (releaseData.releaseType === "initial-release") {
    let notes: string = "Initial release. 👶\n\n"
    if (releaseData.projectInfo.version !== "1.0.0") {
      notes += `Remark: No previous release was found, but project version is greater than 1.0.0, starting release tag from project version: ${releaseData.projectInfo.version}.\n\n`
    }
    return notes
  }

  if (!releaseData.commits || releaseData.commits.length === 0) {
    throw new Error("No commits in releaseData, something is wrong...")
  }

  const sortedCommits: SortedCommits = sortCommitsByType(releaseData.commits)
  return generateCommitNotes(sortedCommits)
}
