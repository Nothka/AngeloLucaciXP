// Example utility function in a parent component or a hook

function formatXPTime(date) {
  if (!(date instanceof Date) || isNaN(date)) {
    // Handle case where date is invalid
    return '0:00 AM'; 
  }

  // Use toLocaleTimeString for robust, localized 12-hour time.
  const options = {
    hour: 'numeric', // e.g., 3
    minute: '2-digit', // e.g., 05
    hour12: true, // Crucial for AM/PM
  };
  return date.toLocaleTimeString('en-US', options); // Result: "3:05 AM"
}
// Example usage:
// const currentTime = formatXPTime(new Date()); // Result: "3:52 AM"