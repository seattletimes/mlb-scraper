var ipc = require("electron").ipcRenderer;

var days = document.querySelector(".days");

var getDayID = data => [data.year, data.month, data.day].map(n => parseInt(n, 10)).join("-");

var makeDay = function(data) {
  var day = document.createElement("li");
  var dateString = getDayID(data);
  day.setAttribute("day", dateString);
  var label = dateString;
  if (data.games) {
    label += ` - ${data.games.length} games`;
  }
  day.innerHTML = `<label>${label}</label>`;
  days.appendChild(day);
  return day;
};

var getGameElement = function(game) {
  var existing = document.querySelector(`[game="${game.id}"]`);
  if (existing) return existing;
  var day = days.querySelector(`[day="${getDayID(game)}"]`);
  if (!day) {
    day = makeDay(game);
  }
  var gameElement = document.createElement("div");
  gameElement.setAttribute("game", game.id);
  gameElement.className = "game";
  gameElement.innerHTML = `
<h2>${game.away.toUpperCase()} vs. ${game.home.toUpperCase()}</h2>
<span class="metadata status">game</span>
<span class="players status">players</span>
<span class="pitches status">pitches</span>
  `;
  day.appendChild(gameElement);
  return gameElement;
};

ipc.on("update", function(sender, e) {
  if (e.games && e.games.length) {
    makeDay(e);
  }
  if (e.game) {
    var element = getGameElement(e.game);
    element.classList.add(e.type);
  }
});