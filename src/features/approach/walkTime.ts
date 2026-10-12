/**
 * Walking times as a signpost writes them.
 *
 * Its own module so PlannerPanel.tsx exports a component only, which React fast refresh needs.
 */

/** `1 h 25 min`, or `40 min` under the hour. */
export const formatMinutes = (minutes: number): string => {
    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return hours ? `${hours} h ${rest} min` : `${rest} min`;
};
