// Format a date as a string
export const formatDate = (date: Date): string => {
  // Get the date parts from the input date
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  const day = date.getDate();

  // Create a specific date from parts with noon time to avoid timezone issues
  // Use local date parsing instead of UTC to match the expected behavior in tests
  const normalizedDate = new Date(year, month, day, 12, 0, 0, 0);

  return normalizedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};
