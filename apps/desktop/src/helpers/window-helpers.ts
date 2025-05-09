export async function minimizeWindow() {
  window.electronAPI.send("minimize-window");
}
export async function maximizeWindow() {
  window.electronAPI.send("maximize-window");
}
export async function closeWindow() {
  window.electronAPI.send("close-window");
}
