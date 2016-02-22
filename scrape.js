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
}

var processGame = function(game, callback) {
  // var gameString = `${game.away.toUpperCase()} vs ${game.home.toUpperCase()}`;
  // console.log(`    Pulling game: ${gameString}`);
  if (game.away == "tba" || game.home == "tba") return callback();
  facade.emit("update", { game, type: "process-game" });
  gameday.getGameDetail(game, function(err, game) {
    if (err) {
      //some games have no stats
      if (err.statusCode) facade.emit("update", { game, type: "no-game-details" });
      return callback();
    }
    facade.emit("update", { game, type: "game-details" });
    async.parallel([
      c => db.addGame(game, c),
      c => processPlayers(game, c),
      c => processPitches(game, c)
    ], function() {
      facade.emit("update", { game, type: "finished-game" });
      callback();
    });
  });
}

var processGames = function(games, callback) {
  async.eachLimit(games, 10, processGame, callback);
};

var months = [];
for (var y = 2008; y < 2016; y++) {
  for (var m = 1; m < 13; m++) {
    months.push({ year: y, month: m });
  }
}

var scrape = function(callback) {
  async.eachSeries(months, function(m, done) {
    gameday.getDays(m.year, m.month, function(err, days) {
      if (err) return done(err);
      async.eachLimit(days, 3, function(day, next) {
        // facade.emit("update", { month: m.month, year: m.year, day: day });
        console.log(`Requesting data for ${m.year}-${m.month}-${day}`);
        gameday.getGames(m.year, m.month, day, function(err, games) {
          facade.emit("update", { year: m.year, month: m.month, day, games, type: "list-games" });
          console.log(`  Processing ${m.year}-${m.month}-${day} - ${games.length} games`);
          processGames(games, next);
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