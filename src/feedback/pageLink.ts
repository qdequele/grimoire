/**
 * Whether a feedback's `page` may be a link in the admins' inbox: a path on this site only. The
 * sender controls the value (the database only bounds its length), and a link to another site
 * there would be a ready-made phishing link. Refused: another origin (`https://…`, `//host`, and
 * `/\host`, which browsers read as `//host`), any backslash, and white space (browsers drop tabs
 * and line breaks from an address, so `/<tab>/host` is `//host`).
 */
export const isAppPage = (page: string): boolean => /^\/(?![/\\])[^\\\s]*$/.test(page)
