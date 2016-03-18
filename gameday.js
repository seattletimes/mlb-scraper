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
    var score = $score("linescore").toArray().shift().attribs;
    game.away_score = score.away_team_runs * 1;
    game.home_score = score.home_team_runs * 1;
    var teams = $game("team").toArray().forEach(function(t) {
      var team = {
        id: t.attribs.id,
        abbreviation: t.attribs.code,
        name: t.attribs.name_brief
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
    var players = $("player").toArray().map(function(p) {
      return {
        id: p.attribs.id,
        first: p.attribs.first,
        last: p.attribs.last,
        position: p.attribs.current_position || p.attribs.position,
        num: p.attribs.num,
        team: p.attribs.team_abbrev
      }
    });
    callback(null, players);
  });
};

var numerics = "x y start_speed end_speed pfx_x pfx_z px pz x0 y0 z0 vx0 vy0 vz0 ax ay az break_y break_angle break_length type_confidence zone spin_dir spin_rate";
numerics = numerics.split(" ");

var getPitches = function(game, callback) {
  var url = makeGameURL(game) + "/inning/inning_all.xml";
  request(url, function(err, response, body) {
    if (err) return callback(err);
    if (response.statusCode >= 300) return callback(null, []);
    var $ = cheerio.load(body);
    var innings = $("inning").toArray();
    var plays = [];
    innings.forEach(function(inning) {
      var atBats = $(inning).find("atbat").toArray();
      atBats.forEach(function(atBat) {
        var pitches = $(atBat).find("pitch").toArray();
        pitches.forEach(function(pitch) {
          var data = {
            id: pitch.attribs.sv_id,
            game: game.id,
            inning: parseInt(inning.attribs.num, 10),
            batter: atBat.attribs.batter,
            at_bat: parseInt(atBat.attribs.num, 10),
            pitcher: atBat.attribs.pitcher,
            designation: pitch.attribs.des,
            pitch_type: pitch.attribs.pitch_type
          };
          numerics.forEach(n => data[n] = parseFloat(pitch.attribs[n]));
          plays.push(data);
        });
      })
    })
    callback(null, plays);
  });
}

module.exports = { getDays, getGames, getGameDetail, getPlayers, getPitches, makeGameURL }