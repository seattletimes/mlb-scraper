var async = require("async");
var EventEmitter = require("events");
var gameday = require("./gameday");
var db = require("./database");

var facade = new EventEmitter();

var processPlayers = function(game, callback) {
  facade.emit("update", { game, type: "process-players" });
  // console.log(`      Getting players`)
  gameday.getPlayers(game, function(err, players) {
    if (err) return callback(err);
    facade.emit("update", { game, type: "save-players" });
    async.each(players, function(player, playerDone) {
      async.parallel([
        c => db.addPlayer(player, c),
        c => db.addPosition(game, player, c)
      ], playerDone);
    }, function() {
      facade.emit("update", { game, type: "finished-players" });
      callback();
    });
  });
};

var processPitches = function(game, callback) {
  // console.log(`      Getting pitches`);
  facade.emit("update", { game, type: "process-pitches" });
  gameday.getPitches(game, function(err, pitches) {
    facade.emit("update", { game, type: "save-pitches" });
    if (err) return callback();
    async.each(pitches, db.addPitch, function() {
      facade.emit("update", { game, type: "finished-pitches" });
      callback();
    });
  });
};

var processAtBats = function(game, callback) {
  facade.emit("update", { game, type: "process-atbats" });
  gameday.getScores(game, function(err, atBats) {
    facade.emit("update", { game, type: "save-atbats" });
    if (err) return callback();
    async.each(atBats, (a, c) => db.addAtBat(game, a, c), function(err) {
      if (err) return callback();
      facade.emit("update", { game, type: "finished-atbats" });
      callback();
    })
  });
};

var processGame = function(original, callback) {
  // var gameString = `${game.away.toUpperCase()} vs ${game.home.toUpperCase()}`;
  // console.log(`    Pulling game: ${gameString}`);
  if (original.away == "tba" || original.home == "tba") return callback();
  facade.emit("update", { original, type: "process-game" });
  gameday.getGameDetail(original, function(err, game) {
    if (err) {
      //some games have no stats
      if (err.statusCode) facade.emit("update", { game: original, type: "no-game-details" });
      console.log("No game details", original.id);
      return callback();
    }
    facade.emit("update", { game, type: "game-details" });
    async.parallel([
      c => db.addGame(game, c),
      c => processPlayers(game, c),
      c => processPitches(game, c),
      c => processAtBats(game, c)
    ], function() {
      facade.emit("update", { game, type: "finished-game" });
      callback();
    });
  });
}

var processGames = function(games, callback) {
  async.eachLimit(games, 10, processGame, callback);
};

var scrape = function(months, callback) {

  async.eachSeries(months, function(m, done) {
    gameday.getDays(m.year, m.month, function(err, days) {
      if (err) return done(err);
      async.eachSeries(days, function(day, next) {
        // facade.emit("update", { month: m.month, year: m.year, day: day });
        console.log(`Requesting data for ${m.year}-${m.month}-${day}`);
        gameday.getGames(m.year, m.month, day, function(err, games) {
          facade.emit("update", { year: m.year, month: m.month, day, games, type: "list-games" });
          console.log(`  Processing ${m.year}-${m.month}-${day} - ${games.length} games`);
          if (!games.length) return next();
          processGames(games, function() {
            facade.emit("update", { year: m.year, month: m.month, day, games, type: "finished-day" });
            next();
          });
        });
      }, done);
    });
  }, function(err) {
    if (err) console.log(err);
    db.close();
    if (callback) callback();
  });
};

facade.scrape = scrape;

module.exports = facade;