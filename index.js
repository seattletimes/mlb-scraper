var async = require("async");

var gameday = require("./gameday");
var db = require("./database");

var processPlayers = function(game, callback) {
  console.log(`      Getting players`);
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

var processPitches = function(game, callback) {
  console.log(`      Getting pitches`)
  gameday.getPitches(game, function(err, pitches) {
    if (err) return callback();
    async.each(pitches, db.addPitch, callback);
  });
}

var processGame = function(game, callback) {
  var gameString = `${game.away.toUpperCase()} vs ${game.home.toUpperCase()}`;
  console.log(`    Pulling game: ${gameString}`);
  if (game.away == "tba" || game.home == "tba") return callback();
  gameday.getGameDetail(game, function(err, game) {
    if (err && err.statusCode != 404) return callback(); //skip games with no detail
    async.parallel([
      c => db.addGame(game, c),
      c => processPlayers(game, c),
      c => processPitches(game, c)
    ], callback);
  });
}

var processGames = function(games, callback) {
  async.eachSeries(games, processGame, callback);
};

var months = [];
for (var y = 2008; y < 2009; y++) {
  for (var m = 4; m < 5; m++) {
    months.push({ year: y, month: m });
  }
}

async.each(months, function(m, done) {
  gameday.getDays(m.year, m.month, function(err, days) {
    if (err) return done(err);
    async.eachSeries(days, function(day, next) {
      console.log(`Requesting data for ${m.year}-${m.month}-${day}`);
      gameday.getGames(m.year, m.month, day, function(err, games) {
        console.log(`  Processing ${m.year}-${m.month}-${day} - ${games.length} games`);
        processGames(games, next);
      });
    }, done);
  });
}, function(err) {
  if (err) console.log(err);
  db.close();
});