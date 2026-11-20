-- Point every club at its logo file in the repo's logos/ folder (logos/<club id>.png).
-- Clubs without a file simply show the colored code badge (the page falls back automatically).
update clubs set logo_url = 'logos/' || id || '.png' where logo_url is null;
