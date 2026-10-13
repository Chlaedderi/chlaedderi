/**
 * Hand a file to the browser.
 *
 * Throws where a browser refuses a script-made download; the caller says so rather than appearing
 * to have done nothing.
 */
export const downloadFile = (filename: string, text: string, type: string): void => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Revoked a moment later rather than at once: some browsers start the download after the
    // click handler has returned, and a revoked address downloads nothing.
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 1000);
};
