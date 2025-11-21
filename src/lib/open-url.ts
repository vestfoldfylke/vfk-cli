import { type ExecException, exec } from "node:child_process"

export const openUrl = (url: string, message: string = ""): void => {
	let command: string

	url = url.replaceAll("(", "%28").replaceAll(")", "%29")

	switch (process.platform) {
		case "darwin": // macOS
			command = `open "${url}"`
			break
		case "win32": // Windows
			command = `start "${url.replaceAll("&", "^&")}"`
			break
		default: // Linux and other POSIX-like systems
			command = `xdg-open "${url}"`
			break
	}

	exec(command, (error: ExecException | null) => {
		if (error) {
			console.error(`Error opening URL: ${error.message}`)
			return
		}

		const messageStr: string = message.length > 0 ? `${message}: ` : ""
		console.log(`${messageStr}${url}`)
	})
}
