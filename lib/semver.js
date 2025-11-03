// @ts-check

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import semver from "semver"
import { ProjectInfo } from "./types/zod.js"

/**
 * @param {string[]} tags
 * @returns {?string}
 */
export const getLatestSemverTag = (tags) => {
	const semverTags = tags.filter((tag) => semver.valid(tag))
	return semver.maxSatisfying(semverTags, "*", { includePrerelease: true })
}

/**
 * @returns {import('./types/zod.js').ProjectInfo}
 */
export const getProjectInfo = () => {
	// Read project version from relevant file based on project type
	// Node.js - package.json
	if (existsSync("./package.json")) {
		const pkg = JSON.parse(readFileSync("./package.json", "utf-8"))
		const paths = ["./package.json"]
		if (existsSync("./package-lock.json")) {
			paths.push("./package-lock.json")
		}
		return {
			version: semver.valid(pkg.version),
			type: "node",
			paths
		}
	}
	// .NET - .csproj
	const csProjFiles = readdirSync("./", { recursive: true }).filter((filename) => typeof filename === "string" && filename.endsWith(".csproj"))
	if (!csProjFiles.every((file) => typeof file === "string")) {
		throw new Error("Error reading .csproj files, not all filenames are strings.")
	}
	if (csProjFiles.length > 0) {
		const versions = csProjFiles
			.map((file) => {
				const content = readFileSync(`./${file}`, "utf-8")
				const match = content.match(/<Version>(.*?)<\/Version>/)
				if (match && match.length > 1) {
					throw new Error(`Multiple <Version> tags found in .csproj file ${file}`)
				}
				return match ? { version: match[1], path: file } : null
			})
			.filter((v) => v !== null)
		if (versions.length > 1) {
			throw new Error("Multiple .csproj files with version tag found in solution.")
		}
		if (versions.length === 0) {
			throw new Error("No <Version> tag found in any .csproj file.")
		}
		return {
			version: semver.valid(versions[0].version),
			type: "dotnet",
			paths: [versions[0].path]
		}
	}
	// Add more project types as needed
	throw new Error("Unsupported project type for version retrieval.")
}

/**
 *
 * @param {string} semver1
 * @param {string} semver2
 * @returns {boolean}
 */
const hasBeenIncreasedOneTime = (semver1, semver2) => {
	const diffType = semver.diff(semver1, semver2) // 'major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease' or null
	if (!diffType) return false
	const incrementedVersion = semver.inc(semver1, diffType)
	return incrementedVersion === semver2
}

/**
 * Checks if the project version has already been bumped from the latest tag, and is greater than current bump from latest tag.
 * @param {string} latestTag
 * @param {string} projectVersion
 * @param {'patch' | 'minor' | 'major'} releaseType
 * @returns {boolean}
 */
export const useExistingProjectVersion = (latestTag, projectVersion, releaseType) => {
	if (!semver.valid(latestTag) || !semver.valid(projectVersion)) {
		return false
	}
	if (!hasBeenIncreasedOneTime(latestTag, projectVersion)) {
		return false
	}
	if (semver.lt(projectVersion, semver.inc(latestTag, releaseType))) {
		return false
	}
	return true
}

/**
 *
 * Finds the next version based on latest tag and project version.
 * Favors the latest semver tag, and fallbacks to project version if semver tag is not present.
 *
 * @param {?string} latestTag
 * @param {ProjectInfo} projectInfo
 * @param {'patch' | 'minor' | 'major'} releaseType
 * @returns {import('./types/zod.js').NextVersion}
 */
export const getNextVersion = (latestTag, projectInfo, releaseType) => {
	if (!semver.valid(projectInfo.version) && !semver.valid(latestTag)) {
		return {
			version: "1.0.0",
			isInitialRelease: true,
			source: "vfk-cli"
		}
	}
	if (latestTag && semver.valid(latestTag)) {
		// Check if project version already has been bumped one time from latest tag - if so, someone else has already merged to main before the release
		if (semver.valid(projectInfo.version) && useExistingProjectVersion(latestTag, projectInfo.version, releaseType)) {
			return {
				version: projectInfo.version,
				isInitialRelease: false,
				source: "project-already-bumped"
			}
		}
		return {
			version: semver.inc(latestTag, releaseType),
			isInitialRelease: false,
			source: "tag"
		}
	}
	const isInitialRelease = projectInfo.version === "1.0.0"
	return {
		version: isInitialRelease ? "1.0.0" : semver.inc(projectInfo.version, releaseType),
		isInitialRelease,
		source: "project"
	}
}

/**
 *
 * @param {ProjectInfo} projectInfo
 * @param {string} newVersion
 * @return {void}
 */
export const updateProjectVersion = (projectInfo, newVersion) => {
	projectInfo = ProjectInfo.parse(projectInfo)
	if (!semver.valid(newVersion)) {
		throw new Error(`Invalid semver version: ${newVersion}`)
	}
	switch (projectInfo.type) {
		case "node": {
			for (const path of projectInfo.paths) {
				const pkg = JSON.parse(readFileSync(path, "utf-8"))
				pkg.version = newVersion
				writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8")
			}
			break
		}
		case "dotnet": {
			for (const path of projectInfo.paths) {
				const content = readFileSync(path, "utf-8")
				const newContent = content.replace(/<Version>(.*?)<\/Version>/, `<Version>${newVersion}</Version>`)
				writeFileSync(path, newContent, "utf-8")
			}
			break
		}
		default:
			throw new Error(`Unsupported project type: ${projectInfo.type}`)
	}
}
