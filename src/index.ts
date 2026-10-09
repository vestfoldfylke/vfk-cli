#!/usr/bin/env -S node --enable-source-maps

import pkg from "../package.json" with { type: "json" }
import { checkUpdateExists } from "./lib/update-exists.js"
import { nilsrelease } from "./tools/nilsrelease.js"
import { pr } from "./tools/pr.js"
import { release } from "./tools/release.js"

type Tool = "--version" | "-v" | "release" | "pr" | "nilsrelease" | "help" | ""

const selectedTool: Tool = (process.argv[2] as Tool) || ""
const tools: Tool[] = ["release", "pr", "nilsrelease"]

const startUpdateExists: Promise<string> = tools.includes(selectedTool) && process.stdout.isTTY ? checkUpdateExists(pkg.name, pkg.version) : Promise.resolve("")

const usage = `vfk <command>

Usage:

vfk pr <type>      				create a GitHub pull request of the specified type (patch, minor, major)
vfk release        				create a GitHub release with auto-release notes and tag from project version
vfk nilsrelease <type>    create a GitHub release with auto-release notes and tag from project version without creating a pull request (will update project version and push directly to default branch, use only if your name is Nils, or you like to live dangerously)
vfk help           				display this help message
vfk --version      				display the current version of VFK CLI
`

const args: string[] = process.argv.slice(3)

try {
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
} finally {
  const updateExists: string = await startUpdateExists
  if (updateExists !== "") {
    process.stdout.write(`\n\u001b[33m${updateExists}\u001b[0m`)
  }
}
