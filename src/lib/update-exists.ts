import semver from "semver"
import type { Update } from "../types/update.js"

export const checkUpdateExists = async (packageName: string, packageVersion: string): Promise<Update> => {
  try {
    const response: Response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(1500)
    })

    if (!response.ok) {
      const errorText: string = await response.text()
      return {
        message: `Failed to check for new version. Status: ${response.status}. StatusText: ${response.statusText}. Error: ${errorText}`,
        success: false
      }
    }

    const data: unknown = await response.json()
    if (typeof data === "object" && data !== null && "version" in data && typeof data.version === "string" && semver.gt(data.version, packageVersion)) {
      return {
        message: `New version available: ${packageVersion} -> ${data.version}  (npm i -g ${packageName})`,
        success: true
      }
    }

    return {
      message: "",
      success: true
    }
  } catch (error) {
    return {
      message: `Failed to check for new version. Error: ${(error as Error).message}`,
      success: false
    }
  }
}
