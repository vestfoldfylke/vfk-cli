export type ProjectInfo = {
	version: string
	type: "node" | "dotnet"
	paths: string[]
  name?: string
}

export type NextVersion = {
	version: string
	isInitialRelease: boolean
	source: "tag" | "project" | "project-already-bumped" | "vfk-cli"
	description: string
}

export type ReleaseType = "major" | "minor" | "patch" | "initial-release"
