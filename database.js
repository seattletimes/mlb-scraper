var async = require("async");
var pg = require("pg");
var creds = require("./creds.json")
var database = new pg.Client(creds);
database.connect();

var verbose = process.argv.some(a => a.match(/--verbose|-v$/));

log = function() {
  if (verbose) console.log.apply(console, arguments);
}

var SQL = function(parts) {
  var values = [];
  for (var i = 1; i < arguments.length; i++) values.push(arguments[i]);
  return {
    text: parts.reduce((prev, current, i) => prev + "$" + i + current),
    values
  }
};

var addGame = function(game, callback) {
  var query = SQL`
    INSERT INTO games (id, date, venue, home_team, away_team, home_score, away_score)
      VALUES (${game.id}, ${game.date}, ${game.venue}, ${game.home}, ${game.away}, ${game.home_score}, ${game.away_score})`;

  database.query(query, function(err) {
    if (err) {
      if (err.detail.match(/already exists/)) {
        log("Ignoring existing game", game.id);
      } else {
        callback(err);
      }
    }
    //add the teams if the game was successful
    async.each([game.home_team, game.away_team], function(t, c) {
      if (t) addTeam(t, c);
    }, callback);
  });
};

var addTeam = function(team, callback) {
  var query = SQL`
    INSERT INTO teams (id, name, abbreviation)
      VALUES (${team.id}, ${team.name}, ${team.abbreviation});`;
  var q = database.query(query, function(err) {
    //swallow "already exists" errors
    if (err && err.detail.match(/already exists/)) {
      log(`Ignoring existing team: ${team.name}`);
      return callback();
    }
    callback(err)
  });
};

var addPitch = function(pitch, callback) {
  var query = SQL`
    INSERT INTO pitches (
      id,
      game,
      inning,
      at_bat,
      designation,
      batter,
      pitcher,
      x,
      y,
      start_speed,
      end_speed,
      pfx_x,
      pfx_y,
      pfx_z,
      px,
      pz,
      x0,
      y0,
      z0,
      vx0,
      vy0,
      vz0,
      ax,
      ay,
      az,
      break_y,
      break_angle,
      break_length,
      pitch_type,
      pitch_confidence,
      zone,
      spin_dir,
      spin_rate
    ) VALUES (
      ${pitch.id},
      ${pitch.game},
      ${pitch.inning},
      ${pitch.at_bat},
      ${pitch.designation},
      ${pitch.batter},
      ${pitch.pitcher},
      ${pitch.x},
      ${pitch.y},
      ${pitch.start_speed},
      ${pitch.end_speed},
      ${pitch.pfx_x},
      ${pitch.pfx_y},
      ${pitch.pfx_z},
      ${pitch.px},
      ${pitch.pz},
      ${pitch.x0},
      ${pitch.y0},
      ${pitch.z0},
      ${pitch.vx0},
      ${pitch.vy0},
      ${pitch.vz0},
      ${pitch.ax},
      ${pitch.ay},
      ${pitch.az},
      ${pitch.break_y},
      ${pitch.break_angle},
      ${pitch.break_length},
      ${pitch.pitch_type},
      ${pitch.pitch_confidence},
      ${pitch.zone},
      ${pitch.spin_dir},
      ${pitch.spin_rate}
    )`;
  database.query(query, function(err) {
    if (err && err.detail.match(/already exists/)) {
      log(`Ignoring pitch: ${pitch.id}`);
      return callback();
    }
    callback(err);
  })
};

var addPlayer = function(player, callback) {
  var query = SQL`
    INSERT INTO players (id, first, last)
      VALUES (${player.id}, ${player.first}, ${player.last});`;
  var q = database.query(query, function(err) {
    if (err && err.detail.match(/already exists/)) {
      log(`Ignoring existing player: ${player.first} ${player.last}`);
      return callback();
    }
    callback(err);
  });
};

var addPosition = function(game, player, callback) {
  var query = SQL`
    INSERT INTO positions (player, position, team, num, game)
      VALUES (${player.id}, ${player.position}, ${player.team}, ${player.num}, ${game.date})`;
  var q = database.query(query, function(err) {
    callback(err)
  });
};


var close = () => database.end()

module.exports = { addGame, addPlayer, addPosition, addTeam, addPitch, close };