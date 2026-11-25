# WordFlow modernization

This directory is an isolated migration foundation, not a production replacement. The existing root app remains unchanged.

Use Node.js 22 LTS. Run `npm install`, `npm test`, `npm run build`, and `npm run dev` from this directory. Commit the generated lockfile after verifying dependencies and before production CI uses npm ci. Do not deploy this scaffold as the production app. The legacy workspace and Supabase schema must remain compatible.
