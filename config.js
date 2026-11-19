/* Public connection settings for the SquadCraft database (Supabase project "SquadCraft").
   The anon key is meant to be public: it can only do what the row-level-security policies allow
   (read the player data; read/write only the workspaces that carry your own x-owner-token).
   NEVER put the service_role key or the database password in this file. */
window.SC_CONFIG = {
  url: "https://ereihenyjzpsecbebksg.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZWloZW55anpwc2VjYmVia3NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNzkxNzUsImV4cCI6MjExMDY1NTE3NX0.lcghkx0EejBoJver-w4BuhwkQRQb3aS3hcAib3G4Wc8"
};
