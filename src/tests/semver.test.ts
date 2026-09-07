import assert from "node:assert"
import { afterEach, describe, it } from "node:test"
import { getLatestSemverTag, getNextVersion, getProjectInfo, useExistingProjectVersion } from "../lib/semver.js"
import type { NextVersion, ProjectInfo } from "../types/semver.js"
import type { SupportedSemverType } from "../types/tools.js"

const originalCwd: string = process.cwd()
const testDataProjectFolder: string = "src/tests/data/projectinfo"

describe("getLatestSemverTag", () => {
  it("should return the latest semver tag", () => {
    // This test assumes that the git repository has at least one semver tag.
    const latestTag: string | null = getLatestSemverTag(["v3.0.0", "v1.1.0", "v2.0.0", "v5.0.1-beta", "v6.0.0", "not-a-tag"])
    assert.strictEqual(latestTag, "v6.0.0")
  })
})

describe("getNextVersion", () => {
  it("should calculate the next version correctly if project is already increased", () => {
    const latestTag = "1.2.3"
    const projectInfo: ProjectInfo = {
      version: "1.2.4",
      type: "node",
      paths: ["./package.json"]
    }
    const releaseType = "minor"

    const nextVersion: NextVersion = getNextVersion(latestTag, projectInfo, releaseType)
    assert.strictEqual(nextVersion.version, "1.3.0")
    assert.strictEqual(nextVersion.source, "tag")
    assert.strictEqual(nextVersion.isInitialRelease, false)
  })

  it("should calculate the next version correctly if project is behind latest tag", () => {
    const latestTag = "2.0.0"
    const projectInfo: ProjectInfo = {
      version: "1.5.0",
      type: "node",
      paths: ["./package.json"]
    }
    const releaseType = "patch"

    const nextVersion: NextVersion = getNextVersion(latestTag, projectInfo, releaseType)
    assert.strictEqual(nextVersion.version, "2.0.1")
    assert.strictEqual(nextVersion.source, "tag")
    assert.strictEqual(nextVersion.isInitialRelease, false)
  })

  it("should throw if no valid versions exist", () => {
    const latestTag = null
    const projectInfo: ProjectInfo = {
      // @ts-expect-error Testing invalid version
      version: null,
      type: "node",
      paths: ["./package.json"]
    }
    const releaseType = "major"

    assert.throws(() => {
      getNextVersion(latestTag, projectInfo, releaseType)
    }, /No valid version found/)
  })

  it("should use tag if tag and project version are the same", () => {
    const latestTag = "1.0.0"
    const projectInfo: ProjectInfo = {
      version: "1.0.0",
      type: "node",
      paths: ["./package.json"]
    }
    const releaseType = "minor"

    const nextVersion: NextVersion = getNextVersion(latestTag, projectInfo, releaseType)
    assert.strictEqual(nextVersion.version, "1.1.0")
    assert.strictEqual(nextVersion.source, "tag")
    assert.strictEqual(nextVersion.isInitialRelease, false)
  })

  for (const releaseType of ["patch", "minor", "major"]) {
    it(`should return 1.0.0 and mark as initial release if project version is 1.0.0 and no tags exist when releaseType is '${releaseType}'`, () => {
      const latestTag = null
      const projectInfo: ProjectInfo = {
        version: "1.0.0",
        type: "node",
        paths: ["./package.json"]
      }

      const nextVersion: NextVersion = getNextVersion(latestTag, projectInfo, releaseType as SupportedSemverType)
      assert.strictEqual(nextVersion.version, "1.0.0")
      assert.strictEqual(nextVersion.source, "project")
      assert.strictEqual(nextVersion.isInitialRelease, true)
    })
  }
})

describe("getProjectInfo", () => {
  afterEach(() => {
    process.chdir(originalCwd)
  })

  it("should throw when neither a 'package.json' or a 'dotnet.csproj' file exists", () => {
    process.chdir(`${originalCwd}/${testDataProjectFolder}`)

    assert.throws(() => getProjectInfo())
  })

  it("should return ProjectInfo for Node.js when ONLY a 'package.json' file exists", () => {
    process.chdir(`${originalCwd}/${testDataProjectFolder}/NodeOnly`)

    let projectInfo: ProjectInfo | null = null

    assert.doesNotThrow(() => {
      projectInfo = getProjectInfo()
    })

    assert.equal(projectInfo !== null, true)
    assert.equal((projectInfo as unknown as ProjectInfo).version, "1.2.3")
    assert.equal((projectInfo as unknown as ProjectInfo).type, "node")
    assert.equal(Array.isArray((projectInfo as unknown as ProjectInfo).paths), true)
    assert.equal((projectInfo as unknown as ProjectInfo).paths.length, 1)
    assert.equal((projectInfo as unknown as ProjectInfo).paths[0], "./package.json")
    assert.equal((projectInfo as unknown as ProjectInfo).name, "node-only")
  })

  it("should return ProjectInfo for dotnet when ONLY a 'dotnet.csproj' file exists", () => {
    process.chdir(`${originalCwd}/${testDataProjectFolder}/DotnetOnly`)

    let projectInfo: ProjectInfo | null = null

    assert.doesNotThrow(() => {
      projectInfo = getProjectInfo()
    })

    assert.equal(projectInfo !== null, true)
    assert.equal((projectInfo as unknown as ProjectInfo).version, "6.5.4")
    assert.equal((projectInfo as unknown as ProjectInfo).type, "dotnet")
    assert.equal(Array.isArray((projectInfo as unknown as ProjectInfo).paths), true)
    assert.equal((projectInfo as unknown as ProjectInfo).paths.length, 1)
    assert.equal((projectInfo as unknown as ProjectInfo).paths[0], "dotnet.csproj")
    assert.equal((projectInfo as unknown as ProjectInfo).name, undefined)
  })

  it("should return ProjectInfo for dotnet when BOTH a 'package.json' and a 'dotnet.csproj' file exists", () => {
    process.chdir(`${originalCwd}/${testDataProjectFolder}/DotnetAndNode`)

    let projectInfo: ProjectInfo | null = null

    assert.doesNotThrow(() => {
      projectInfo = getProjectInfo()
    })

    assert.equal(projectInfo !== null, true)
    assert.equal((projectInfo as unknown as ProjectInfo).version, "4.5.6")
    assert.equal((projectInfo as unknown as ProjectInfo).type, "dotnet")
    assert.equal(Array.isArray((projectInfo as unknown as ProjectInfo).paths), true)
    assert.equal((projectInfo as unknown as ProjectInfo).paths.length, 1)
    assert.equal((projectInfo as unknown as ProjectInfo).paths[0], "dotnet.csproj")
    assert.equal((projectInfo as unknown as ProjectInfo).name, undefined)
  })
})

describe("useExistingProjectVersion", () => {
  it("should return true if project version has already been increased one time with semver type from latest tag, and we also want to increase with the same semver type", () => {
    const patch: boolean = useExistingProjectVersion("1.2.3", "1.2.4", "patch")
    assert.strictEqual(patch, true)
    const minor: boolean = useExistingProjectVersion("1.2.3", "1.3.0", "minor")
    assert.strictEqual(minor, true)
    const major: boolean = useExistingProjectVersion("1.2.3", "2.0.0", "major")
    assert.strictEqual(major, true)
  })

  it("should return false if project version has been increased more than one time from latest tag (someone has messed with it)", () => {
    const result: boolean = useExistingProjectVersion("1.2.3", "1.4.1", "minor")
    assert.strictEqual(result, false)
  })

  it("should return false if project version has already been increased with patch but we want to increase with minor", () => {
    const result: boolean = useExistingProjectVersion("1.2.3", "1.2.4", "minor")
    assert.strictEqual(result, false)
  })

  it("should return false if project version is behind latest tag", () => {
    const result: boolean = useExistingProjectVersion("2.0.0", "1.5.0", "major")
    assert.strictEqual(result, false)
  })

  it("should return false if project version is the same as latest tag", () => {
    const result: boolean = useExistingProjectVersion("1.2.3", "1.2.3", "minor")
    assert.strictEqual(result, false)
  })

  it("should return false if either version is invalid", () => {
    const result1: boolean = useExistingProjectVersion("not-a-version", "1.2.4", "patch")
    assert.strictEqual(result1, false)
    const result2: boolean = useExistingProjectVersion("1.2.3", "also-not-a-version", "patch")
    assert.strictEqual(result2, false)
  })
})
