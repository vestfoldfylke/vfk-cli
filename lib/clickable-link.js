/**
 *
 * @param {string} link
 * @param {?string} [linkText]
 * @returns {string}
 */
export const clickableLink = (link, linkText) => {
	return `\u001b]8;;${link}\u001b\\${linkText || link}\u001b]8;;\u001b\\`
}
