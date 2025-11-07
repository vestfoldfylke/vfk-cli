import { execSync } from "node:child_process"
import type { ProjectInfo } from "../types/semver.js"

export const runTests = (projectInfo: ProjectInfo): void => {
	switch (projectInfo.type) {
		case "node": {
			execSync("npm test")
			break
		}
		case "dotnet": {
			execSync("dotnet test")
			break
		}
		default:
			throw new Error(`Unsupported project type for running tests: ${projectInfo.type}`)
	}
}
