import { spawnSync } from "node:child_process"

export const openUrl = (url: string, message: string = ""): void => {
  let command: string
  let args: string[]

  url = url.replaceAll("(", "%28").replaceAll(")", "%29")

  switch (process.platform) {
    case "darwin": // macOS
      command = "open"
      args = [url]
      break
    case "win32": // Windows
      command = "cmd.exe"
      args = ["/c", "start", '""', url.replaceAll("&", "^&")]
      break
    default: // Linux and other POSIX-like systems
      command = `xdg-open`
      args = [url]
      break
  }

  const result = spawnSync(command, args, { stdio: "inherit" })

  if (result.error) {
    console.error(`Error opening URL: ${result.error.message}`)
  } else if (result.status !== 0) {
    console.error(`Error opening URL. Process exited with code ${result.status}`)
  }

  const messageStr: string = message.length > 0 ? `${message}: ` : ""
  console.log(`${messageStr}${url}`)
}
