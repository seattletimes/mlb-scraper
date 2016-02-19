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

// gameday.getGames(2008, 4, 6, function(err, games) {
//   games = games.filter(g => g.away == "sea" || g.home == "sea");
//   if (!games.length) return console.log("No SEA games for that day");

//   processGames(games, () => db.close());
// });

var months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

async.map(months, gameday.getDays.bind(null, 2008), function(err, result) {
  result.forEach(function(days, i) {
    console.log(months[i], days);
  });
  db.close();
});