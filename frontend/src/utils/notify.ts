/** Desktop/browser notification helper (replaces Tauri notification plugin). */
export async function sendNotification(options: { title: string; body: string }): Promise<void> {
  try {
    if (typeof Notification === "undefined") {
      return;
    }
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification(options.title, { body: options.body });
    }
  } catch {
    // Notifications are best-effort; ignore failures in WebView
  }
}
