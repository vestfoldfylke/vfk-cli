// @ts-check

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import semver from "semver"
import type { NextVersion, ProjectInfo, ReleaseType } from "../types/semver.js"
import type { SupportedSemverType } from "../types/tools.js"

export const SUPPORTED_SEMVER_TYPES_BY_PRIORITY: SupportedSemverType[] = ["major", "minor", "patch"]

export const getLatestSemverTag = (tags: string[]): string | null => {
	const semverTags = tags.filter((tag) => semver.valid(tag))
	return semver.maxSatisfying(semverTags, "*", { includePrerelease: true })
}

export const getProjectInfo = (): ProjectInfo => {
	// Read project version from relevant file based on project type
	// Node.js - package.json
	if (existsSync("./package.json")) {
		const pkg = JSON.parse(readFileSync("./package.json", "utf-8"))
		const paths = ["./package.json"]
		if (existsSync("./package-lock.json")) {
			paths.push("./package-lock.json")
		}
		if (!semver.valid(pkg.version)) {
			throw new Error(`Invalid semver version in package.json: ${pkg.version}, please fix it manually before proceeding...`)
		}
		return {
			version: pkg.version,
			type: "node",
			paths,
			name: pkg.name
		}
	}

	// .NET - .csproj
	const csProjFiles = readdirSync("./", { recursive: true }).filter((filename) => typeof filename === "string" && filename.endsWith(".csproj") && !filename.match(/\/bin\/|\/obj\//))
	if (!csProjFiles.every((file) => typeof file === "string")) {
		throw new Error("Error reading .csproj files, not all filenames are strings.")
	}
	if (csProjFiles.length > 0) {
		const versions: { version: string | undefined; path: string }[] | null = csProjFiles
			.map((file) => {
				const content = readFileSync(`./${file}`, "utf-8")
				const match = content.match(/<Version>(.*?)<\/Version>/)
				return match ? { version: match[1], path: file } : null
			})
			.filter((v: { version: string | undefined; path: string } | null) => v !== null)

		if (versions.length > 1) {
			throw new Error("Multiple .csproj files with version tag found in solution.")
		}

		if (versions.length === 0) {
			throw new Error("No <Version> tag found in any .csproj file.")
		}

		if (!semver.valid(versions[0]?.version)) {
			throw new Error(`Invalid semver version in ${versions[0]?.path}: ${versions[0]?.version}, please fix it manually before proceeding...`)
		}

		if (!versions[0]?.path) {
			throw new Error("Error reading .csproj file path.")
		}

		return {
			version: versions[0]?.version as string, // We know it's defined here, as semver.valid passed
			type: "dotnet",
			paths: [versions[0]?.path as string]
		}
	}

	// Add more project types as needed
	throw new Error("Unsupported project type for version retrieval.")
}

const hasBeenIncreasedOneTime = (semver1: string, semver2: string) => {
	const diffType = semver.diff(semver1, semver2) // 'major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease' or null
	if (!diffType) return false
	const incrementedVersion = semver.inc(semver1, diffType)
	return incrementedVersion === semver2
}

export const useExistingProjectVersion = (latestTag: string, projectVersion: string, releaseType: SupportedSemverType): boolean => {
	if (!semver.valid(latestTag) || !semver.valid(projectVersion)) {
		return false
	}
	if (!hasBeenIncreasedOneTime(latestTag, projectVersion)) {
		return false
	}

	return !semver.lt(projectVersion, semver.inc(latestTag, releaseType) as string) // We already checked that both projectVersion and latestTag are valid above
}

/**
 *
 * Finds the next version based on latest tag and project version.
 * If project version is already sufficiently increased from latest tag, it will be used (and not increased again).
 * Favors the latest semver tag, and fallbacks to project version if semver tag is not present.
 */
export const getNextVersion = (latestTag: string | null, projectInfo: ProjectInfo, releaseType: SupportedSemverType): NextVersion => {
	if (!semver.valid(projectInfo.version) && !semver.valid(latestTag)) {
		throw new Error("No valid version found from latest tag or project version.")
	}
	if (latestTag && semver.valid(latestTag)) {
		// Check if project version already has been bumped one time from latest tag - if so, someone else has already merged to main before the release
		if (projectInfo.version && semver.valid(projectInfo.version) && useExistingProjectVersion(latestTag, projectInfo.version, releaseType)) {
			return {
				version: projectInfo.version,
				isInitialRelease: false,
				source: "project-already-bumped",
				description: "Project version has already been bumped sufficiently from latest tag"
			}
		}
		return {
			version: semver.inc(latestTag, releaseType) as string,
			isInitialRelease: false,
			source: "tag",
			description: `Increased ${releaseType} from latest tag ${latestTag}`
		}
	}
	const isInitialRelease = projectInfo.version === "1.0.0"
	return {
		version: isInitialRelease ? "1.0.0" : (semver.inc(projectInfo.version as string, releaseType) as string), // We also know that projectInfo.version is valid here
		isInitialRelease,
		source: "project",
		description: `No valid latest tag found, using project version as base`
	}
}

export const updateProjectVersion = (projectInfo: ProjectInfo, newVersion: string): void => {
	if (!semver.valid(newVersion)) {
		throw new Error(`Invalid semver version for new version: ${newVersion}`)
	}

	switch (projectInfo.type) {
		case "node": {
			for (const path of projectInfo.paths) {
				// We do not parse JSON to preserve formatting yes
				const content = readFileSync(path, "utf-8")
				if (projectInfo.name) {
					const newContent = content.replace(new RegExp(`("name": "${projectInfo.name}",\\s+"version": ")[^"]*(")`, "g"), (_: string, prefix: string, suffix: string): string => {
						return `${prefix}${newVersion}${suffix}`
					})
					writeFileSync(path, newContent, "utf-8")
					continue
				}

				const newContent = content.replace(/"version": "(.*?)"/, `"version": "${newVersion}"`)
				writeFileSync(path, newContent, "utf-8")
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

export const getSemverReleaseType = (latestTag: string | null, projectInfo: ProjectInfo): ReleaseType => {
	if (!projectInfo.version || !semver.valid(projectInfo.version)) {
		throw new Error("Cannot determine semver type without a valid project version. Please fix it manually.")
	}
	if (!latestTag || !semver.valid(latestTag)) {
		return "initial-release"
	}
	if (!hasBeenIncreasedOneTime(latestTag, projectInfo.version)) {
		throw new Error(`Project version ${projectInfo.version} has not been bumped correctly from latest tag ${latestTag}. Please fix it manually.`)
	}
	const semverType = semver.diff(latestTag, projectInfo.version)
	if (!semverType) {
		throw new Error("Cannot determine semver type from latest tag and project version. Please fix it manually.")
	}
	if (!SUPPORTED_SEMVER_TYPES_BY_PRIORITY.includes(semverType as SupportedSemverType)) {
		throw new Error(`Unsupported semver difference type: ${semverType}. Must be one of ${SUPPORTED_SEMVER_TYPES_BY_PRIORITY.join(", ")}. Please fix it manually.`)
	}
	return semverType as ReleaseType
}
