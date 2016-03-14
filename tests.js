var async = require("async");
var cheerio = require("cheerio");
var request = require("request");
var gameday = require("./gameday");
var pg = require("pg");

var database = new pg.Client(require("./creds.json"));
database.connect();

var tests = []
var results = {
  passed: 0,
  failed: 0,
  total: 0
};

//randomly test five games
for (var i = 0; i < 5; i++) {
  var year = Math.round(Math.random() * 5) + 2009;
  var month = Math.round(Math.random() * 4) + 5;
  var day = Math.round(Math.random() * 27) + 1;
  tests.push({
    title: `Test for pitches on ${year}-${month}-${day}`,
    test: function(callback) {
      gameday.getGames(year, month, day, function(err, games) {
        if (err) return callback(err);
        var game = games[Math.floor(Math.random() * games.length)];
        console.log(`Game is ${game.home} vs ${game.away}`);
        var url = gameday.makeGameURL(game) + "/inning/inning_all.xml";
        request(url, function(err, response, body) {
          if (err) return callback(err);
          var $ = cheerio.load(body);
          var pitches = $("pitch").toArray().map(function(p) {
            return {
              id: p.attribs.sv_id,
              pfx_x: parseFloat(p.attribs.pfx_x),
              end_speed: parseFloat(p.attribs.end_speed)
            };
          });
          console.log(`Checking ${pitches.length} pitches`);
          async.eachSeries(pitches, function(pitch, c) {
            database.query(`SELECT * FROM pitches WHERE id = '${pitch.id}'`, function(err, result) {
              if (err) return c(`Missing pitch: ${pitch.id}`);
              if (result.rows.length == 0) return c(`No pitch found for ${pitch.id}`);
              if (result.rows.length > 1) return c(`Duplicate rows for pitch ${pitch.id}`);
              var p = result.rows.pop();
              if (p.pfx_x != pitch.pfx_x) {
                console.log(`Expected pfx_x of ${pitch.pfx_x}, found ${p.pfx_x}`);
                return c(`Data didn't match on pitch ${pitch.id}`);
              }
              if (p.end_speed != pitch.end_speed) {
                console.log(`Expected end_speed of ${pitch.end_speed}, found ${p.end_speed}`);
                return c(`Data didn't match on pitch ${pitch.id}`);
              }
              c();
            })
          }, function(err) {
            if (err) {
              console.log(err);
            } else {
              console.log("Everything checked out!");
            }
            callback(err);
          });
        });
      });
    }
  });
}

async.eachSeries(tests, function(t, c) {
  console.log(t.title);
  results.total++;
  t.test(function(err) {
    if (err) {
      results.failed++;
    } else {
      results.passed++;
    }
    c();
  });
}, function() {
  console.log(`Final result: ${results.passed} passed, ${results.failed} failed, ${results.total} total`);
  database.end();
});