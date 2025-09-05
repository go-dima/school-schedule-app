export class NotificationService {
  /**
   * Log notification about new user pending approval (in-app only)
   */
  static async notifyAdminsOfPendingApproval(
    userEmail: string,
    requestedRole: string
  ): Promise<void> {
    try {
      const roleDisplayNames: Record<string, string> = {
        admin: "מנהל",
        staff: "צוות",
        parent: "הורה",
        child: "תלמיד",
      };

      const roleDisplay = roleDisplayNames[requestedRole] || requestedRole;

      console.log(
        `🔔 בקשה חדשה לאישור - ${userEmail} מבקש תפקיד: ${roleDisplay}`
      );
      console.log(`📅 תאריך בקשה: ${new Date().toLocaleDateString("he-IL")}`);

      // In the future, this could store in-app notifications in a database table
      // For now, we rely on the PendingApprovalsPage to show new requests
    } catch (error) {
      console.error("❌ Failed to log notification:", error);
      // Don't throw - notification failure shouldn't block user signup
    }
  }
}
