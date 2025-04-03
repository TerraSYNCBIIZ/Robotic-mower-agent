import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines multiple class names into a single string using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a timestamp as a relative time string (e.g., "5 minutes ago")
 * @param timestamp Date, number (timestamp in ms), or string (parsable date)
 * @returns Formatted string like "just now", "5 minutes ago", "2 hours ago", etc.
 */
export function getTimeAgo(timestamp: Date | number | string): string {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date 
    ? timestamp 
    : typeof timestamp === 'number'
      ? new Date(timestamp)
      : new Date(timestamp);
      
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // Convert to seconds
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  
  // Convert to minutes
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  
  // Convert to hours
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  
  // Convert to days
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  // Format as date for older timestamps
  return date.toLocaleDateString();
} 