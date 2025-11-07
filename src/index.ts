#!/usr/bin/env node --enable-source-maps

import { pr } from "./tools/pr.js"
import { release } from "./tools/release.js"

const usage = `vfk <command>

Usage:

vfk pr <type>      create a GitHub pull request of the specified type (patch, minor, major)
vfk release        create a GitHub release with auto-release notes and tag from project version
vfk help           display this help message
`

type Tool = "release" | "pr" | "help" | ""

const selectedTool: Tool = (process.argv[2] as Tool) || ""

const args = process.argv.slice(3)

switch (selectedTool) {
	case "pr":
		pr(...args)
		break
	case "release":
		release(...args)
		break
	case "help":
		console.log(usage)
		break
	case "":
		console.log(usage)
		break
	default:
		throw new Error("SPECIFIED TOOL NOT FOUND")
}
