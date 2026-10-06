/**
 * Hand the user a file to save (a browser download). Injected into the commands as `saveFile`,
 * so tests capture the text instead of downloading.
 */
export type SaveFile = (filename: string, text: string, mime: string) => void;

export const downloadFile: SaveFile = (filename, text, mime) => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
