import assert from "node:assert"
import { describe, it } from "node:test"

import { getLatestSemverTag, getNextVersion, useExistingProjectVersion } from "../../lib/semver.js"

describe("getLatestSemverTag", () => {
	it("should return the latest semver tag", () => {
		// This test assumes that the git repository has at least one semver tag.
		const latestTag = getLatestSemverTag(["v3.0.0", "v1.1.0", "v2.0.0", "v5.0.1-beta", "v6.0.0", "not-a-tag"])
		assert.strictEqual(latestTag, "v6.0.0")
	})
})

describe("getNextVersion", () => {
	it("should calculate the next version correctly if project is already increased", () => {
		const latestTag = "1.2.3"
		/** @type {import('../../lib/types/zod.js').ProjectInfo} */
		const projectInfo = {
			version: "1.2.4",
			type: "node",
			paths: ["./package.json"]
		}
		const releaseType = "minor"

		const nextVersion = getNextVersion(latestTag, projectInfo, releaseType)
		assert.strictEqual(nextVersion.version, "1.3.0")
		assert.strictEqual(nextVersion.source, "tag")
		assert.strictEqual(nextVersion.isInitialRelease, false)
	})
	it("should calculate the next version correctly if project is behind latest tag", () => {
		const latestTag = "2.0.0"
		/** @type {import('../../lib/types/zod.js').ProjectInfo} */
		const projectInfo = {
			version: "1.5.0",
			type: "node",
			paths: ["./package.json"]
		}
		const releaseType = "patch"

		const nextVersion = getNextVersion(latestTag, projectInfo, releaseType)
		assert.strictEqual(nextVersion.version, "2.0.1")
		assert.strictEqual(nextVersion.source, "tag")
		assert.strictEqual(nextVersion.isInitialRelease, false)
	})
	it("should return initial version if no valid versions exist", () => {
		const latestTag = null
		/** @type {import('../../lib/types/zod.js').ProjectInfo} */
		const projectInfo = {
			version: null,
			type: "node",
			paths: ["./package.json"]
		}
		const releaseType = "major"

		const nextVersion = getNextVersion(latestTag, projectInfo, releaseType)
		assert.strictEqual(nextVersion.version, "1.0.0")
		assert.strictEqual(nextVersion.source, "vfk-cli")
		assert.strictEqual(nextVersion.isInitialRelease, true)
	})
	it("should use tag if tag and project version are the same", () => {
		const latestTag = "1.0.0"
		/** @type {import('../../lib/types/zod.js').ProjectInfo} */
		const projectInfo = {
			version: "1.0.0",
			type: "node",
			paths: ["./package.json"]
		}
		const releaseType = "minor"

		const nextVersion = getNextVersion(latestTag, projectInfo, releaseType)
		assert.strictEqual(nextVersion.version, "1.1.0")
		assert.strictEqual(nextVersion.source, "tag")
		assert.strictEqual(nextVersion.isInitialRelease, false)
	})
	it("should return 1.0.0 and mark as initial release if project version is 1.0.0 and no tags exist", () => {
		const latestTag = null
		/** @type {import('../../lib/types/zod.js').ProjectInfo} */
		const projectInfo = {
			version: "1.0.0",
			type: "node",
			paths: ["./package.json"]
		}
		const releaseType = "minor"

		const nextVersion = getNextVersion(latestTag, projectInfo, releaseType)
		assert.strictEqual(nextVersion.version, "1.0.0")
		assert.strictEqual(nextVersion.source, "project")
		assert.strictEqual(nextVersion.isInitialRelease, true)
	})
})

describe("useExistingProjectVersion", () => {
	it("should return true if project version has been already been increased one time with semver type from latest tag, and we also want to increase with the same semver type", () => {
		const patch = useExistingProjectVersion("1.2.3", "1.2.4", "patch")
		assert.strictEqual(patch, true)
		const minor = useExistingProjectVersion("1.2.3", "1.3.0", "minor")
		assert.strictEqual(minor, true)
		const major = useExistingProjectVersion("1.2.3", "2.0.0", "major")
		assert.strictEqual(major, true)
	})
	it("should return false if project version has been increased more than one time from latest tag (someone has messed with it)", () => {
		const result = useExistingProjectVersion("1.2.3", "1.4.1", "minor")
		assert.strictEqual(result, false)
	})
	it("should return false if project version has already been increased with patch but we want to increase with minor", () => {
		const result = useExistingProjectVersion("1.2.3", "1.2.4", "minor")
		assert.strictEqual(result, false)
	})
	it("should return false if project version is behind latest tag", () => {
		const result = useExistingProjectVersion("2.0.0", "1.5.0", "major")
		assert.strictEqual(result, false)
	})
	it("should return false if project version is the same as latest tag", () => {
		const result = useExistingProjectVersion("1.2.3", "1.2.3", "minor")
		assert.strictEqual(result, false)
	})
	it("should return false if either version is invalid", () => {
		const result1 = useExistingProjectVersion("not-a-version", "1.2.4", "patch")
		assert.strictEqual(result1, false)
		const result2 = useExistingProjectVersion("1.2.3", "also-not-a-version", "patch")
		assert.strictEqual(result2, false)
	})
})
