import { readdirSync } from "node:fs"
import { extname } from "node:path"

export const isDotnetSolutionRoot = (directory: string = process.cwd()): boolean => {
  return readdirSync(directory).some((name: string) => [".sln", ".slnx"].includes(extname(name).toLowerCase()))
}
