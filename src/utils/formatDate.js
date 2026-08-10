import { format, isValid } from "date-fns";

/** Safe date formatting — avoids Invalid time value crashes */
export function safeFormatDate(value, pattern = "MMM d, yyyy", fallback = "—") {
  if (value == null || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return fallback;
  try {
    return format(date, pattern);
  } catch {
    return fallback;
  }
}
