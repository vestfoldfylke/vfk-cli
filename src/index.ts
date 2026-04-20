#!/usr/bin/env -S node --enable-source-maps

import pkg from "../package.json" with { type: "json" }
import { nilsrelease } from "./tools/nilsrelease.js"
import { pr } from "./tools/pr.js"
import { release } from "./tools/release.js"

const usage = `vfk <command>

Usage:

vfk pr <type>      create a GitHub pull request of the specified type (patch, minor, major)
vfk release        create a GitHub release with auto-release notes and tag from project version
vfk nilsrelease    create a GitHub release with auto-release notes and tag from project version without creating a pull request (will update project version and push directly to main branch, use only if your name is Nils, or you like to live dangerously)
vfk help           display this help message
vfk --version      display the current version of VFK CLI
`

type Tool = "--version" | "-v" | "release" | "pr" | "nilsrelease" | "help" | ""

const selectedTool: Tool = (process.argv[2] as Tool) || ""

const args: string[] = process.argv.slice(3)

switch (selectedTool) {
	case "--version":
	case "-v":
		console.log(pkg.version)
		break
	case "pr":
		pr(...args)
		break
	case "release":
		release(...args)
		break
	case "nilsrelease":
		nilsrelease(...args)
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
