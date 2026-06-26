/** Background DocuSign polling on page load was removed — it consumed DocuSign API quota. Use cron or the manual refresh button instead. */
export async function runNyweBackgroundDocuSignSync(): Promise<void> {
  return;
}
