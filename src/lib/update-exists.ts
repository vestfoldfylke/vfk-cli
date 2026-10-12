import semver from "semver"

export const checkUpdateExists = async (packageName: string, packageVersion: string): Promise<string> => {
  try {
    const response: Response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(1500)
    })

    if (!response.ok) {
      return ""
    }

    const data: unknown = await response.json()
    if (typeof data === "object" && data !== null && "version" in data && typeof data.version === "string" && semver.gt(data.version, packageVersion)) {
      return `New version available: ${packageVersion} -> ${data.version}  (npm i -g ${packageName})`
    }
  } catch {}

  return ""
}
