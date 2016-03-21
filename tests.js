var async = require("async");
var cheerio = require("cheerio");
var request = require("request");
var gameday = require("./gameday");
var pg = require("pg");
pg.defaults.parseInt8 = true;
var chalk = require("chalk");

var database = new pg.Client(require("./creds.json"));
database.connect();

var tests = []
var results = {
  passed: 0,
  failed: 0,
  total: 0
};

var testPitches = function(body, callback) {
  var $ = cheerio.load(body);
  var pitches = [];
  var atBats = $("atbat").toArray().forEach(function(atBat) {
    var within = $(atBat).find("pitch").toArray().map(function(p) {
      return {
        id: p.attribs.sv_id || p.attribs.id,
        pfx_x: parseFloat(p.attribs.pfx_x),
        start_speed: parseFloat(p.attribs.start_speed),
        end_speed: parseFloat(p.attribs.end_speed),
        batter: atBat.attribs.batter,
        pitcher: atBat.attribs.pitcher,
        at_bat: parseFloat(atBat.attribs.num)
      };
    }).filter(p => p.id);
    pitches.push.apply(pitches, within);
  });
  console.log(`    Checking ${pitches.length} pitches`);
  async.eachSeries(pitches, function(pitch, c) {
    database.query(
      `SELECT * FROM pitches WHERE id = '${pitch.id}' AND game = '${game.id}' AND at_bat = ${pitch.at_bat}`,
      function(err, result) {
        if (err) return c(`Missing pitch: ${pitch.id}`);
        if (result.rows.length == 0) return c(`No pitch found for ${pitch.id}`);
        var p = result.rows.pop();
        for (var key in pitch) {
          if (key == "id") continue;
          if (pitch[key] !== p[key] && (!isNaN(pitch[key]) && !isNaN(p[key]))) {
            return c(`    Mismatched value for ${key} on pitch ${pitch.id} (${pitch[key]} vs ${p[key]})`);
          }
        }
        c();
      })
  }, function(err) {
    if (err) {
      console.log(chalk.red(err));
    } else {
      console.log(chalk.green("Everything checked out!"));
    }
    callback(err);
  });
};

//randomly test five games
for (var i = 0; i < 20; i++) {
  var year = Math.round(Math.random() * 5) + 2008;
  var month = Math.round(Math.random() * 4) + 5;
  var day = Math.round(Math.random() * 27) + 1;
  tests.push({
    title: `Test for pitches on ${year}-${month}-${day}`,
    test: function(callback) {
      gameday.getGames(year, month, day, function(err, games) {
        if (err) return callback(err);
        var game = games[Math.floor(Math.random() * games.length)];
        if (!game) {
          console.log("  Game was undefined, which is weird and shouldn't be possible.");
          return callback();
        }
        if (game.home == 'tba' || game.away == 'tba') {
          console.log("  Game is TBA, skipping")
          return callback();
        }
        console.log(`  Game is ${game.home.toUpperCase()} vs ${game.away.toUpperCase()}`);

        request(gameday.makeGameURL(game) + "/inning/inning_all.xml", function(err, response, body) {
          if (err) return callback(err);
          if (response.statusCode >= 400) {
            request(gameday.makeGameURL(game) + `/inning/inning_${Math.ceil(Math.random() * 7)}.xml`, function(err, response, body) {
              if (err) return callback(err);
              testPitches(body, callback);
            });
          } else {
            testPitches(body, callback);
          }
        });
      });
    }
  });
}

async.eachSeries(tests, function(t, c) {
  console.log(chalk.cyan(t.title));
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
  console.log(chalk.bgWhite.black(`Final result: ${results.passed} passed, ${results.failed} failed, ${results.total} total`));
  database.end();
});