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
    INSERT INTO games (id, date, venue, home_team, away_team)
      VALUES (${game.id}, ${game.date}, ${game.venue}, ${game.home}, ${game.away})`;

  database.query(query, function(err) {
    if (err) {
      if (err.detail.match(/already exists/)) {
        log("Ignoring existing game", game.id);
      } else {
        callback(err);
      }
    }
    //add the teams if the game was successful
    async.each([game.home_team, game.away_team], (t, c) => addTeam(t, c), callback);
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

var addPitch = function(game, pitch, callback) {

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