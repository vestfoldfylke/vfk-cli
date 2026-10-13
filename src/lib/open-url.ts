import { type SpawnSyncOptionsWithBufferEncoding, spawnSync } from "node:child_process"
import os from "node:os"

type Env = {
  /** f.eks. "Ubuntu" */
  WSL_DISTRO_NAME?: string
  /** ofte "true", men kan være "1" eller noe annet */
  CI?: string
  /** "klient-ip klient-port server-ip server-port" */
  SSH_CONNECTION?: string
  /** f.eks. "/dev/pts/0" */
  SSH_TTY?: string
  /** f.eks. ":0" */
  DISPLAY?: string
  /** f.eks. "wayland-0" */
  WAYLAND_DISPLAY?: string
}

type OpenCommand = [string, string[]] | null

const envs: Env = process.env as Env

const isWsl = (): boolean => process.platform === "linux" && (Boolean(envs.WSL_DISTRO_NAME) || os.release().toLowerCase().includes("microsoft"))

const getOpenCommand = (url: string): OpenCommand => {
  if ((envs.CI && envs.CI !== "false") || envs.SSH_CONNECTION || envs.SSH_TTY) {
    // Does not support opening a browser
    return null
  }

  if (process.platform === "darwin") {
    // MacOS
    return ["open", [url]]
  }

  if (process.platform === "win32") {
    // Windows
    return ["rundll32", ["url.dll,FileProtocolHandler", url]]
  }

  if (isWsl()) {
    // Wsl on Windows
    return ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
  }

  if (envs.DISPLAY || envs.WAYLAND_DISPLAY) {
    // Linux and other POSIX-like systems
    return ["xdg-open", [url]]
  }

  return null
}

export const openUrl = (url: string, message: string = ""): void => {
  // NOTE: Replacing '(' and ')' is necessary for making the url clickable in JetBrains IDE's
  url = url.replaceAll("(", "%28").replaceAll(")", "%29")

  const openCommand: OpenCommand = getOpenCommand(url)

  if (openCommand) {
    const [command, args] = openCommand

    const spawnOptions: SpawnSyncOptionsWithBufferEncoding = {
      stdio: "ignore",
      timeout: 5000
    }

    const result = spawnSync(command, args, spawnOptions)

    if (result.error) {
      console.error(`Error opening URL: ${result.error.message}`)
    } else if (result.status !== 0) {
      console.error(`Error opening URL. Process exited with code ${result.status}`)
    }
  }

  const messageStr: string = message.length > 0 ? `${message}: ` : ""
  console.log(`${messageStr}${url}`)
}
