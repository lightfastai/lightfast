export async function minimizeWindow() {
  window.electronWindow?.minimize();
}
export async function maximizeWindow() {
  window.electronWindow?.maximize();
}
export async function closeWindow() {
  window.electronWindow?.close();
}
