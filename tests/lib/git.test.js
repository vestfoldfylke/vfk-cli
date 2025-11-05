import assert from "node:assert"
import { describe, it } from "node:test"
import { parseGitLogs, sortCommitsByType } from "../../lib/git.js"

const rawLog = `commithash1\x00Franken Stein\x00franken.stein@smyger.no\x00Merge remote-tracking branch 'origin/main' into mordor\x00\x002025-11-03T14:13:00+01:00\x00ENDOFCOMMIT\x00
commithash2\x00franky\x00franken.stein@smyger.no\x00En commit med body\x00Jeg er Franky!

Hvordan går det ❤️\x002025-11-03T14:12:33+01:00\x00ENDOFCOMMIT\x00
commithash3\x00Franken Stein\x00franken.stein@smyger.no\x00chore: bump version to 3.3.1\x00\x002025-10-29T13:06:56+01:00\x00ENDOFCOMMIT\x00
`
const outputCommitSeparator = "\x00ENDOFCOMMIT\x00\n"
const propertySeparator = "\x00"

describe("parseGitLogs", () => {
	it("should parse git logs into structured commits", () => {
		const propertyNamesInOrder = ["hash", "author", "authorEmail", "subject", "body", "date"]

		const commits = parseGitLogs(rawLog, outputCommitSeparator, propertySeparator, propertyNamesInOrder)

		assert.strictEqual(commits.length, 3)

		assert.deepStrictEqual(commits[0], {
			hash: "commithash1",
			author: "Franken Stein",
			authorEmail: "franken.stein@smyger.no",
			subject: "Merge remote-tracking branch 'origin/main' into mordor",
			body: "",
			date: "2025-11-03T14:13:00+01:00"
		})
		assert.deepStrictEqual(commits[1], {
			hash: "commithash2",
			author: "franky",
			authorEmail: "franken.stein@smyger.no",
			subject: "En commit med body",
			body: "Jeg er Franky!\n\nHvordan går det ❤️",
			date: "2025-11-03T14:12:33+01:00"
		})

		assert.deepStrictEqual(commits[2], {
			hash: "commithash3",
			author: "Franken Stein",
			authorEmail: "franken.stein@smyger.no",
			subject: "chore: bump version to 3.3.1",
			body: "",
			date: "2025-10-29T13:06:56+01:00"
		})
	})
	it("should return empty array for empty log", () => {
		const propertyNamesInOrder = ["hash", "author", "authorEmail", "subject", "body", "date"]

		const commits = parseGitLogs("", outputCommitSeparator, propertySeparator, propertyNamesInOrder)

		assert.strictEqual(commits.length, 0)
	})
	it("should throw error if more properties are requested than available", () => {
		const propertyNamesInOrder = ["hash", "author", "authorEmail", "subject", "body", "date", "extraProperty"]

		assert.throws(() => {
			parseGitLogs(rawLog, outputCommitSeparator, propertySeparator, propertyNamesInOrder)
		}, /You are asking for more properties than available in git log output/)
	})
})

// Check that sortCommitsByType and getCommitType works as expected
describe("sortCommitsByType", () => {
	it("should sort commits by type correctly", () => {
		/** @type {import('../../lib/types/zod.js').GitLogCommit[]} */
		const commits = [
			{ hash: "hash1", authorName: "Author", authorEmail: "author@example.com", subject: "feat: add new feature", body: "", commitDate: "2025-11-11T10:00:00Z" }, // Should be first minor
			{ hash: "hash2", authorName: "Author", authorEmail: "author@example.com", subject: "fix - fix a bug", body: "", commitDate: "2025-11-02T10:00:00Z" }, // Should be first patch
			{ hash: "hash3", authorName: "Author", authorEmail: "author@example.com", subject: "chore: update dependencies", body: "", commitDate: "2025-12-03T10:00:00Z" }, // Should be first maintenance
			{ hash: "hash4", authorName: "Author", authorEmail: "author@example.com", subject: "docs: update README", body: "", commitDate: "2025-11-10T10:00:00Z" }, // Should be second maintenance
			{ hash: "hash5", authorName: "Author", authorEmail: "author@example.com", subject: "refactor - improve code structure", body: "", commitDate: "2025-11-05T10:00:00Z" }, // Should be third maintenance
			{ hash: "hash6", authorName: "Author", authorEmail: "author@example.com", subject: "perf: improve performance", body: "", commitDate: "2025-11-01T10:00:00Z" }, // Should be second patch
			{ hash: "hash7", authorName: "Author", authorEmail: "author@example.com", subject: "breaking change: overhaul API", body: "", commitDate: "2025-11-07T10:00:00Z" }, // Should be only major
			{ hash: "hash8", authorName: "Author", authorEmail: "author@example.com", subject: "minor: add minor improvement", body: "", commitDate: "2025-11-08T08:00:00Z" }, // Should be second minor
			{ hash: "hash9", authorName: "Author", authorEmail: "author@example.com", subject: "unknown type commit", body: "", commitDate: "2025-11-09T10:00:00Z" }, // Should be only other
			{ hash: "hash10", authorName: "Author", authorEmail: "author@example.com", subject: "chore frankestein type commit", body: "", commitDate: "2025-11-08T10:00:00Z" } // Should be the second other
		]

		const sorted = sortCommitsByType(commits)

		assert.strictEqual(sorted.major.length, 1)
		assert.strictEqual(sorted.major[0].subject, "breaking change: overhaul API")

		assert.strictEqual(sorted.minor.length, 2)
		assert.strictEqual(sorted.minor[0].subject, "feat: add new feature")
		assert.strictEqual(sorted.minor[1].subject, "minor: add minor improvement")

		assert.strictEqual(sorted.patch.length, 2)
		assert.strictEqual(sorted.patch[0].subject, "fix - fix a bug")
		assert.strictEqual(sorted.patch[1].subject, "perf: improve performance")

		assert.strictEqual(sorted.maintenance.length, 3)
		assert.strictEqual(sorted.maintenance[0].subject, "chore: update dependencies")
		assert.strictEqual(sorted.maintenance[1].subject, "docs: update README")
		assert.strictEqual(sorted.maintenance[2].subject, "refactor - improve code structure")

		assert.strictEqual(sorted.other.length, 2)
		assert.strictEqual(sorted.other[0].subject, "unknown type commit")
		assert.strictEqual(sorted.other[1].subject, "chore frankestein type commit")
	})
})
