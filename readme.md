Bases loaded
============

This script will download MLB GameDay data to a PostgreSQL database. It runs in either Node or Electron, but the latter will give you a nice status dashboard as it works (the Node version just dumps JSON to stdout, and you'll need to write your own parser to untangle it).

You'll need to create a `creds.json` file with connection information for your database, in the following format:

```json
{
  "host": "databasehost",
  "user": "username",
  "password": "password",
  "database": "mlb_gameday"
}
```

You'll also need to set up your database tables ahead of time. The structure for them should look like this:

```sql
CREATE TABLE games
(
  id text,
  date date,
  venue text,
  home_team text,
  away_team text,
  CONSTRAINT games_id_key UNIQUE (id)
);

CREATE TABLE pitches
(
  id text,
  game text,
  inning integer,
  at_bat integer,
  designation text,
  batter text,
  pitcher text,
  x double precision,
  y double precision,
  start_speed double precision,
  end_speed double precision,
  pfx_x double precision,
  pfx_y double precision,
  pfx_z double precision,
  px double precision,
  pz double precision,
  x0 double precision,
  y0 double precision,
  z0 double precision,
  vx0 double precision,
  vy0 double precision,
  vz0 double precision,
  ax double precision,
  ay double precision,
  az double precision,
  break_y double precision,
  break_angle double precision,
  break_length double precision,
  pitch_type text,
  pitch_confidence double precision,
  zone double precision,
  spin_dir double precision,
  spin_rate double precision
);

CREATE TABLE players
(
  id text,
  first text,
  last text,
  CONSTRAINT players_id_key UNIQUE (id)
);

CREATE TABLE positions
(
  player text,
  "position" text,
  team text,
  num text,
  game date
);

CREATE TABLE teams
(
  id text,
  name text,
  abbreviation text,
  CONSTRAINT teams_id_key UNIQUE (id)
);
```

A player will have one position per game, which includes team information, in case they change positions or are traded. Pitches are associated with a game, and are effectively a merger of the `inning`, `atbat`, and `pitch` nodes in the original MLB XML files.