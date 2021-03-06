var request = require("request");
var cheerio = require("cheerio");
var async = require("async");

var baseURL = "http://gd2.mlb.com/components/game/mlb";

var getDays = function(year, month, callback) {
  if (typeof month == "string") month = parseInt(month, 10);
  var m = month < 10 ? "0" + month : month;
  var url = `${baseURL}/year_${year}/month_${m}/`;
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode >= 300) return callback(null, []);
    var $ = cheerio.load(body);
    var days = $(`a[href^=day]`).toArray().map(d => d.attribs.href.replace(/day_|\/$/g, ""));
    callback(null, days);
  });
};

var getGames = function(year, month, day, callback) {
  if (typeof month == "string") month = parseInt(month, 10);
  if (typeof day == "string") day = parseInt(day, 10);
  var m = month < 10 ? "0" + month : month;
  var d = day < 10 ? "0" + day : day;
  var url = `${baseURL}/year_${year}/month_${m}/day_${d}/`;
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode >= 300) return callback(null, []);
    var $ = cheerio.load(body);
    var games = $(`a[href^="gid"]`).toArray().map(function(link) {
      var matched = link.attribs.href.match(/gid_\d{4}_\d{2}_\d{2}_(\w{3})mlb_(\w{3})mlb_(\d+)/);
      if (matched) return {
        year: year, 
        month: m,
        day: d,
        date: new Date(year, month - 1, day),
        away: matched[1],
        home: matched[2],
        num: matched[3],
        id: year + m + d + matched[1] + matched[2] + matched[3]
      }
    }).filter(g => g);
    callback(null, games);
  });
};

var makeGameURL = function(game) {
  return `${baseURL}/year_${game.year}/month_${game.month}/day_${game.day}/gid_${game.year}_${game.month}_${game.day}_${game.away}mlb_${game.home}mlb_${game.num}`;
};

var getGameDetail = function(game, callback) {
  var url = makeGameURL(game) + "/game.xml";
  var scoreURL = makeGameURL(game) + "/boxscore.xml";
  async.parallel({
    game: (c) => request(url, c),
    scores: (c) => request(scoreURL, c)
  }, function(err, results) {
    if (err) return callback(err);
    var gameResponse = results.game[0];
    var gameBody = results.game[1];
    var scoreResponse = results.scores[0];
    var scoreBody = results.scores[1];
    if (gameResponse.statusCode >= 300) return callback({ statusCode: gameResponse.statusCode });
    var $game = cheerio.load(gameBody);
    var $score = cheerio.load(scoreBody);
    var score = $score("linescore").toArray().shift();
    if (score) {
      game.away_score = score.attribs.away_team_runs * 1;
      game.home_score = score.attribs.home_team_runs * 1;
    }
    var teams = $game("team").toArray().forEach(function(t) {
      var team = {
        id: t.attribs.id,
        abbreviation: t.attribs.code,
        name: t.attribs.name_brief || t.attribs.name
      };
      //assign to home or away
      game[t.attribs.type + "_team"] = team;
    });
    game.venue = $game("stadium").attr("name");
    callback(null, game);
  });
};

var getPlayers = function(game, callback) {
  var url = makeGameURL(game) + "/players.xml";
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode >= 300) return callback(null, []);
    var $ = cheerio.load(body);
    var teams = $("team").toArray();
    var players = [];
    teams.forEach(function(team) {
      var extracted = $(team).find("player").toArray().map(function(p) {
        return {
          id: p.attribs.id,
          first: p.attribs.first,
          last: p.attribs.last,
          position: p.attribs.current_position || p.attribs.position,
          num: p.attribs.num,
          team: team.attribs.id || p.attribs.team_abbrev
        }
      });
      players.push.call(players, extracted);
    });
    callback(null, players);
  });
};

var numerics = "x y start_speed end_speed pfx_x pfx_z px pz x0 y0 z0 vx0 vy0 vz0 ax ay az break_y break_angle break_length type_confidence zone spin_dir spin_rate";
numerics = numerics.split(" ");

var processPitch = function(game, inning, atBat, pitch) {
  var data = {
    id: pitch.attribs.sv_id || pitch.attribs.id,
    game: game.id,
    inning: parseInt(inning.attribs.num, 10),
    batter: atBat.attribs.batter,
    at_bat: parseInt(atBat.attribs.num, 10),
    pitcher: atBat.attribs.pitcher,
    designation: pitch.attribs.des,
    pitch_type: pitch.attribs.pitch_type
  };
  numerics.forEach(n => data[n] = parseFloat(pitch.attribs[n]));
  return data;
}

var getPitchesExplicit = function(game, callback) {
  var inningDir = makeGameURL(game) + "/inning/";
  request(inningDir, function(err, dirResponse, dirBody) {
    if (err) return callback(err);
    //give up if there's no inning at all
    if (dirResponse.statusCode >= 300) return callback(null, []);
    //find all inning_X.xml files
    var $dir = cheerio.load(dirBody);
    var links = $dir("a").toArray().filter(el => el.attribs.href.match(/inning_\d+\.xml/)).map(el => el.attribs.href);
    var plays = [];
    async.each(links, function(link, c) {
      var url = makeGameURL(game) + "/inning/" + link;
      request(url, function(err, response, body) {
        if (err) return c(err);
        var $ = cheerio.load(body);
        var inning = $("inning").toArray().shift();
        var atBats = $("atbat").toArray();
        atBats.forEach(function(atBat) {
          var pitches = $(atBat).find("pitch").toArray();
          pitches.forEach(function(pitch) {
            var data = processPitch(game, inning, atBat, pitch);
            plays.push(data);
          });
        });
        c();
      });
    }, function(err) {
      callback(err, plays);
    });
  });
};

var getPitches = function(game, callback) {
  var url = makeGameURL(game) + "/inning/inning_all.xml";
  request(url, function(err, response, body) {
    if (err) return callback(err);
    //early games don't have inning_all, so scrape for them individually
    if (response.statusCode >= 300) return getPitchesExplicit(game, callback);
    var $ = cheerio.load(body);
    var innings = $("inning").toArray();
    var plays = [];
    innings.forEach(function(inning) {
      var atBats = $(inning).find("atbat").toArray();
      atBats.forEach(function(atBat) {
        var pitches = $(atBat).find("pitch").toArray();
        pitches.forEach(function(pitch) {
          var data = processPitch(game, inning, atBat, pitch);
          plays.push(data);
        });
      })
    })
    callback(null, plays);
  });
};

var getScores = function(game, callback) {
  var url = makeGameURL(game) + "/inning/inning_Scores.xml";
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode >= 300) return callback(null, []);
    var $ = cheerio.load(body);
    var scores = $("score").toArray();
    var results = [];
    scores.forEach(function(score) {
      var atBats = $(score).find("atbat").toArray();
      atBats.forEach(function(atBat) {
        var result = {
          game: game.id,
          inning: parseInt(score.attribs.inn, 10),
          at_bat: parseInt(atBat.attribs.num, 10),
          event: atBat.attribs.event,
          score: atBat.attribs.score == "T",
          balls: parseInt(atBat.attribs.b, 10),
          strikes: parseInt(atBat.attribs.s, 10),
          outs: parseInt(atBat.attribs.o, 10),
          batter: atBat.attribs.batter,
          pitcher: atBat.attribs.pitcher,
          runners: []
        };
        var runners = $(atBat).find("runner").toArray();
        result.runners = runners.map(function(runner) {
          return {
            runner: runner.attribs.id,
            start_base: runner.attribs.start,
            end_base: runner.attribs.end,
            score: runner.attribs.score == "T",
            earned: runner.attribs.earned == "T",
            rbi: runner.attribs.rbi == "T"
          };
        });
        results.push(result);
      });
    });
    callback(null, results);
  });
};

module.exports = {
  getDays,
  getGames,
  getGameDetail,
  getPlayers,
  getPitches: getPitchesExplicit,
  makeGameURL,
  getScores
};