declare global {
  interface Window {
    demo: { platform: string };
  }
}

document.documentElement.dataset.platform = window.demo.platform;

const items = document.querySelectorAll<HTMLButtonElement>(".sidebar .item");

for (const item of items) {
  item.addEventListener("click", () => {
    for (const other of items) {
      other.classList.remove("active");
    }
    item.classList.add("active");
  });
}
