export function disableDevTools() {
  // Disable right click
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Disable common shortcuts
  document.addEventListener("keydown", (e) => {
    const key = e.key.toUpperCase();

    if (
      key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(key)) ||
      (e.ctrlKey && key === "U")
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });
}