var request = require("request");
var cheerio = require("cheerio");

var baseURL = "http://gd2.mlb.com/components/game/mlb";

var getDays = function(year, month, callback) {
  if (typeof month == "string") month = parseInt(month, 10);
  var m = month < 10 ? "0" + month : month;
  var url = `${baseURL}/year_${year}/month_${m}/`;
  request(url, function(err, response, body) {
    if (err) return callback(err);
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
    var $ = cheerio.load(body);
    var games = $(`a[href^="gid"]`).toArray().map(function(link) {
      var matched = link.attribs.href.match(/gid_\d{4}_\d{2}_\d{2}_(\w{3})mlb_(\w{3})mlb/);
      if (matched) return {
        year: year, 
        month: m,
        day: d,
        date: new Date(year, month - 1, day),
        away: matched[1],
        home: matched[2],
        id: year + m + d + matched[1] + matched[2]
      }
    });
    callback(null, games);
  });
};

var makeGameURL = game => `${baseURL}/year_${game.year}/month_${game.month}/day_${game.day}/gid_${game.year}_${game.month}_${game.day}_${game.away}mlb_${game.home}mlb_1`;

var getGameDetail = function(game, callback) {
var url = makeGameURL(game) + "/game.xml";
  request(url, function(err, response, body) {
    if (err) return callback(err);
    var $ = cheerio.load(body);
    var teams = $("team").toArray().forEach(function(t) {
      var team = {
        id: t.attribs.id,
        abbreviation: t.attribs.code,
        name: t.attribs.name_brief
      };
      //assign to home or away
      game[t.attribs.type + "_team"] = team;
    });
    game.venue = $("stadium").attr("name");
    callback(null, game);
  });
};

var getPlayers = function(game, callback) {
  var url = makeGameURL(game) + "/players.xml";
  request(url, function(err, response, body) {
    if (err) return callback(err);
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

module.exports = { getDays, getGames, getGameDetail, getPlayers }