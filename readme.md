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
  inning numeric,
  at_bat numeric,
  designation text,
  batter text,
  pitcher text,
  x numeric,
  y numeric,
  start_speed numeric,
  end_speed numeric,
  pfx_x numeric,
  pfx_y numeric,
  pfx_z numeric,
  px numeric,
  pz numeric,
  x0 numeric,
  y0 numeric,
  z0 numeric,
  vx0 numeric,
  vy0 numeric,
  vz0 numeric,
  ax numeric,
  ay numeric,
  az numeric,
  break_y numeric,
  break_angle numeric,
  break_length numeric,
  pitch_type text,
  pitch_confidence numeric,
  zone numeric,
  spin_dir numeric,
  spin_rate numeric
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