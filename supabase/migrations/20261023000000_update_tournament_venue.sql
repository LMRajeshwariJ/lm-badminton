-- Update existing shared tournament settings to the new event venue.
update public.tournament_config
set state = jsonb_set(
      jsonb_set(
        jsonb_set(
          state,
          '{tournament,venue}',
          '"Sportygen Sports Club"'::jsonb,
          true
        ),
        '{tournament,venueUrl}',
        '"https://www.google.com/maps/search/?api=1&query=Sportygen+Sports+Club%2C+Pune"'::jsonb,
        true
      ),
      '{tournament,city}',
      '"Pune"'::jsonb,
      true
    ),
    revision = revision + 1,
    updated_at = now()
where id = 'main'
  and state ? 'tournament';
