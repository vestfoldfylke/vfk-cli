// @ts-check

import { execSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import semver from "semver"
import type { NextVersion, ProjectInfo, ReleaseType } from "../types/semver.js"
import type { SupportedSemverType } from "../types/tools.js"

type DotnetProjVersionInfo = {
  version: string | undefined
  path: string
}

export const SUPPORTED_SEMVER_TYPES_BY_PRIORITY: SupportedSemverType[] = ["major", "minor", "patch"]

export const getLatestSemverTag = (tags: string[]): string | null => {
  const semverTags: string[] = tags.filter((tag) => semver.valid(tag))
  return semver.maxSatisfying(semverTags, "*", { includePrerelease: true })
}

export const getProjectInfo = (): ProjectInfo => {
  // Read project version from relevant file based on project type
  // Node.js - package.json
  if (existsSync("./package.json")) {
    const pkg = JSON.parse(readFileSync("./package.json", "utf-8"))
    if (!semver.valid(pkg.version)) {
      throw new Error(`Invalid semver version in package.json: ${pkg.version}, please fix it manually before proceeding...`)
    }

    const paths: string[] = ["./package.json"]
    if (existsSync("./package-lock.json")) {
      paths.push("./package-lock.json")
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
    const versions: DotnetProjVersionInfo[] | null = csProjFiles
      .map((file: string) => {
        const content: string = readFileSync(`./${file}`, "utf-8")
        const match: RegExpMatchArray | null = content.match(/<Version>(.*?)<\/Version>/)
        return match ? { version: match[1], path: file } : null
      })
      .filter((v: DotnetProjVersionInfo | null) => v !== null)

    if (versions.length > 1) {
      throw new Error(`Multiple .csproj files with version tag found in solution: ${versions.map((version: DotnetProjVersionInfo) => version.path).join(", ")}`)
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
      version: versions[0].version as string, // We know it's defined here, as semver.valid passed
      type: "dotnet",
      paths: [versions[0].path as string]
    }
  }

  // Add more project types as needed
  throw new Error("Unsupported project type for version retrieval.")
}

const hasBeenIncreasedOneTime = (semver1: string, semver2: string): boolean => {
  const diffType: semver.ReleaseType | null = semver.diff(semver1, semver2) // 'major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease' or null
  if (!diffType) {
    return false
  }

  const incrementedVersion: string | null = semver.inc(semver1, diffType)
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

  const isInitialRelease: boolean = projectInfo.version === "1.0.0"
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
      if (!projectInfo.name) {
        throw new Error("Project name is required to update version.")
      }

      // use builtin npm command to bump project version
      execSync(`npm version ${newVersion} --no-git-tag-version`, {
        timeout: 5000, // Maximum execution time in milliseconds
        killSignal: "SIGKILL", // Forces termination if SIGTERM is ignored (Optional)
        encoding: "utf8" // Returns output as string instead of Buffer
      })
      break
    }
    case "dotnet": {
      for (const path of projectInfo.paths) {
        const content: string = readFileSync(path, "utf-8")
        const newContent: string = content.replace(/<Version>(.*?)<\/Version>/, `<Version>${newVersion}</Version>`)
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

  const semverType: semver.ReleaseType | null = semver.diff(latestTag, projectInfo.version)
  if (!semverType) {
    throw new Error("Cannot determine semver type from latest tag and project version. Please fix it manually.")
  }
  if (!SUPPORTED_SEMVER_TYPES_BY_PRIORITY.includes(semverType as SupportedSemverType)) {
    throw new Error(`Unsupported semver difference type: ${semverType}. Must be one of ${SUPPORTED_SEMVER_TYPES_BY_PRIORITY.join(", ")}. Please fix it manually.`)
  }

  return semverType as ReleaseType
}
