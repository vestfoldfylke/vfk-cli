export const clickableLink = (link: string, linkText?: string) => {
	return `\u001b]8;;${link}\u001b\\${linkText || link}\u001b]8;;\u001b\\`
}
