import { type ChildProcess, spawn } from "node:child_process"

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

	const childProcess: ChildProcess = spawn(command, args, { stdio: "inherit" })

	childProcess.on("error", (error: Error) => {
		console.error(`Error opening URL: ${error.message}`)
	})

	childProcess.on("close", (code: number | null) => {
		if (code === null || code !== 0) {
			console.error(`Error opening URL. Process exited with code ${code}`)
			return
		}

		const messageStr: string = message.length > 0 ? `${message}: ` : ""
		console.log(`${messageStr}${url}`)
	})
}
