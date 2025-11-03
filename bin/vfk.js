#!/usr/bin/env node

import z from 'zod'
import { pr } from '../tools/pr.js'

const usage = `vfk <command>

Usage:

vfk pr <type>      create a GitHub pull request of the specified type (patch, minor, major)
vfk release        create a GitHub release with auto-release notes and tag from project version
vfk help           display this help message
`

/** @typedef { z.infer<typeof Tool> } */
const Tool = z.enum(['release', 'pr', 'help', ''])

const selectedTool = Tool.parse(process.argv[2] || '')

const args = process.argv.slice(3)

switch (selectedTool) {
  case 'pr':
    pr(...args)
    break
  case 'release':
    console.log('RELEASE TOOL SELECTED')
    break
  case 'help':
    console.log(usage)
    break
  case '':
    console.log(usage)
    break
  default:
    throw new Error('NO TOOL SELECTED')
}
