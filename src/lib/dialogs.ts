// Utility functions to replace window.confirm and window.alert with custom dialogs
// These will allow us to avoid using the browser's built-in dialogs
// and use our custom UI components instead

import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

/**
 * React hook that returns utility functions for dialogs and notifications
 */
export function useDialogs() {
  const { confirm } = useConfirm();
  
  /**
   * Shows a confirmation dialog
   * @param message - The message to display
   * @param title - Optional title for the dialog
   * @returns Promise that resolves to true if confirmed, false if cancelled
   */
  const confirmAction = (message: string, title = "Confirm Action") => {
    return confirm({
      title,
      message,
      confirmText: "Continue",
      cancelText: "Cancel"
    });
  };
  
  /**
   * Shows a notification toast
   * @param message - The message to display
   * @param type - Type of notification (success, error, warning, info)
   */
  const notify = (
    message: string, 
    type: "success" | "error" | "warning" | "info" = "info"
  ) => {
    switch (type) {
      case "success":
        toast.success(message);
        break;
      case "error":
        toast.error(message);
        break;
      case "warning":
        toast.warning(message);
        break;
      default:
        toast.info(message);
        break;
    }
  };
  
  return {
    confirmAction,
    notify
  };
} 