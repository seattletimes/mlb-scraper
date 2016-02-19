var async = require("async");

var gameday = require("./gameday");
var db = require("./database");

var processPlayers = function(game, callback) {
  gameday.getPlayers(game, function(err, players) {
    if (err) return callback(err);
    async.each(players, function(player, playerDone) {
      async.parallel([
        c => db.addPlayer(player, c),
        c => db.addPosition(game, player, c)
      ], playerDone);
    }, callback);
  });
};

var processGame = function(game, callback) {
  gameday.getGameDetail(game, function(err, game) {
    db.addGame(game, function() {
      processPlayers(game, callback);
    });
  });
}

var processGames = function(games, callback) {
  async.each(games, processGame, callback);
};

var months = [];
for (var y = 2008; y < 2016; y++) {
  for (var m = 1; m < 13; m++) {
    months.push({ year: y, month: m });
  }
}

async.each(months, function(m, done) {
  gameday.getDays(m.year, m.month, function(err, days) {
    if (err) return done(err);
    async.each(days, function(day, next) {
      gameday.getGames(m.year, m.month, day, function(err, games) {
        processGames(games, next);
      });
    }, done);
  });
}, function(err) {
  if (err) console.log(err);
  db.close();
});