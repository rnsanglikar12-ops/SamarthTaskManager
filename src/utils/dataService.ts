// The app's data-access entry point. Every call site imports from here,
// never from ./supabaseService or ./googleSheetsService directly.
//
// Google Sheets (./googleSheetsService.ts, scripts/apps-script-complete.gs)
// is deprecated as of the Supabase cutover — the app runs on Supabase only
// now. The Sheets implementation is left in place, untouched and unused,
// as a dormant reference in case it's ever needed again; it is not wired up
// here and receives no further maintenance.
export * from './supabaseService';
