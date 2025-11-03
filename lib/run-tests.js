import { execSync } from "node:child_process"
import { ProjectInfo } from "./types/zod.js"

export const runTests = (projectInfo) => {
	projectInfo = ProjectInfo.parse(projectInfo)
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
