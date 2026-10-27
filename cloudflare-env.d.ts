declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Server-side secret that allows creating the first administrator. Remove it after setup. */
    SETUP_TOKEN?: string;
    /** Server-side secret. Needs only the "Mail Send" permission. */
    SENDGRID_API_KEY?: string;
  }
}
