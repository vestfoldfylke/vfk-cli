import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import semver from "semver"

type Config = {
  lastUpdateCheck: string
  updateInterval: number | null
}

const SEVEN_DAYS_MS: number = 7 * 24 * 60 * 60 * 1000

const defaultConfig: Config = {
  lastUpdateCheck: "1970-01-01T00:00:00Z",
  updateInterval: SEVEN_DAYS_MS
}

const getConfig = (configPath: string): Config => {
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(defaultConfig))
    return defaultConfig
  }

  try {
    const config: Config = JSON.parse(readFileSync(configPath).toString())
    if (config.lastUpdateCheck == null || Number.isNaN(new Date(config.lastUpdateCheck).getTime())) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error("lastUpdateCheck must be a valid ISO string")
    }
    if (config.updateInterval !== null && !Number.isInteger(config.updateInterval)) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error("updateInterval must be of type number or null")
    }

    return config
  } catch {
    // config is corrupted
    writeFileSync(configPath, JSON.stringify(defaultConfig))
    return defaultConfig
  }
}

const shouldCheckUpdate = (configPath: string): boolean => {
  try {
    const dirPath: string = dirname(configPath)

    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }

    const config: Config = getConfig(configPath)
    const updateInterval: number | null = config.updateInterval
    if (updateInterval === null) {
      return false
    }

    const msSinceLastUpdateCheck: number = Date.now() - new Date(config.lastUpdateCheck).getTime()
    return msSinceLastUpdateCheck >= updateInterval
  } catch {
    return false
  }
}

const updateLastUpdateCheck = (configPath: string): void => {
  try {
    const config: Config = getConfig(configPath)
    config.lastUpdateCheck = new Date().toISOString()
    writeFileSync(configPath, JSON.stringify(config))
  } catch {}
}

export const checkUpdateExists = async (packageName: string, packageVersion: string): Promise<string> => {
  const nameOnly: string = packageName.slice(packageName.indexOf("/") + 1)
  const configPath: string = join(homedir(), ".config", nameOnly, "config.json")

  if (!shouldCheckUpdate(configPath)) {
    return ""
  }

  try {
    const response: Response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(1500)
    })

    if (!response.ok) {
      updateLastUpdateCheck(configPath)
      return ""
    }

    const data: unknown = await response.json()
    if (typeof data === "object" && data !== null && "version" in data && typeof data.version === "string" && semver.gt(data.version, packageVersion)) {
      updateLastUpdateCheck(configPath)
      return `New version available: ${packageVersion} -> ${data.version}  (npm i -g ${packageName})`
    }
  } catch {}

  updateLastUpdateCheck(configPath)
  return ""
}
