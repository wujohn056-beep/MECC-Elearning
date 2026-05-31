import { myHandler } from './task-reminder-cron.js';

export const handler = async (event, context) => {
    // Allow manual HTTP triggering and direct viewing of diagnostics in browser
    return await myHandler(event, context);
};
