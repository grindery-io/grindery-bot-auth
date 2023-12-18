/**
 * Get the date and time of the last hour from the current time.
 * @returns {Date} Date object representing the last hour.
 */
export function getLastHourDateTime(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

/**
 * Get the date and time of 24 hours ago from the current time.
 * @returns {Date} Date object representing 24 hours ago.
 */
export function getLast24HoursDateTime(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

/**
 * Get the date and time of 1 hour before the provided date.
 * @param {Date} date - The reference date.
 * @returns {Date} Date object representing 1 hour before the provided date.
 */
export function getOneHourBeforeDate(date: Date): Date {
  return new Date(date.getTime() - 60 * 60 * 1000);
}

/**
 * Get the date and time of 24 hours before the provided date.
 * @param {Date} date - The reference date.
 * @returns {Date} Date object representing 24 hours before the provided date.
 */
export function get24HoursBeforeDate(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Get the date and time before the provided date by a specified number of minutes.
 * @param {Date} date - The reference date.
 * @param {number} minutes - Number of minutes to subtract from the reference date.
 * @returns {Date} Date object representing the calculated date and time.
 */
export function getXMinBeforeDate(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

/**
 * Get the date and time before the provided date by a specified number of hours.
 * @param {Date} date - The reference date.
 * @param {number} hours - Number of hours to subtract from the reference date.
 * @returns {Date} Date object representing the calculated date and time.
 */
export function getXHourBeforeDate(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

/**
 * Get the date and time before the provided date by a specified number of days.
 * @param {Date} date - The reference date.
 * @param {number} days - Number of days to subtract from the reference date.
 * @returns {Date} Date object representing the calculated date and time.
 */
export function getXDayBeforeDate(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Formats a Date object to a specific string format.
 * @param date The Date object to format.
 * @returns A string representing the formatted date.
 */
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
}

export const minutesUntilJanFirst2024 = (): number =>
  Math.round(
    (new Date('2024-01-01T00:00:00Z').getTime() - new Date().getTime()) /
      (1000 * 60),
  );
