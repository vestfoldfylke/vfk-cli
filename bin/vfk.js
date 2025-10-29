#!/usr/bin/env node

import z from 'zod'
import { pr } from '../tools/pr.js'

const test = process.argv[2] || 'NO ARGS'

/** @typedef { z.infer<typeof Tool> } */
const Tool = z.enum(['release', 'pr'])

const selectedTool = Tool.parse(process.argv[2])

const args = process.argv.slice(3)

switch (selectedTool) {
  case 'pr':
    pr(...args)
    break
  case 'release':
    console.log('RELEASE TOOL SELECTED')
    break
  default:
    console.log('NO TOOL SELECTED')
}
