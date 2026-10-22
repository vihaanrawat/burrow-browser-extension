importScripts('shared.js');

const SESSION_GAP = 30 * 60 * 1000;   // a pause this long starts a new rabbit hole
const MAX_SESSIONS = 40;
const MAX_DWELL = 5 * 60 * 1000;      // never credit more than this per interval (sleep, lunch...)
const FRESH_START = new Set(['typed', 'generated', 'auto_bookmark', 'start_page', 'keyword', 'keyword_generated']);

