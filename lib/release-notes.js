import { sortCommitsByType } from "./git.js"

/**
 *
 * @param {string} str
 * @returns {string}
 */
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()

/**
 * Generate release notes based on the release data.
 * @param {import('../tools/release.js').ReleaseData} releaseData
 * @returns {string} The generated release notes.
 */
export const generateReleaseNotes = (releaseData) => {
	if (releaseData.semverType === "initial-release") {
		let notes = "Initial release. 👶\n\n"
		if (releaseData.projectInfo.version !== "1.0.0") {
			notes += `Remark: No previous release was found, but project version is greater than 1.0.0, starting release tag from project version: ${releaseData.projectInfo.version}.\n\n`
		}
		return notes
	}
	const emojisByType = {
		major: "🚨",
		minor: "✨",
		patch: "🐛",
		maintenance: "🛠️",
		other: "🤦‍♂️"
	}
	const sortedCommits = sortCommitsByType(releaseData.commits)
	let notes = ""
	// Loop through each commit type and add to notes
	for (const [type, commits] of Object.entries(sortedCommits)) {
		if (commits.length > 0) {
			notes += `### ${emojisByType[type]} **${capitalize(type)} Changes:**\n\n`
			for (const commit of commits) {
				notes += `- ${commit.subject} (${commit.hash})\n`
			}
			notes += "\n"
		}
	}
	return notes.trim()
}
