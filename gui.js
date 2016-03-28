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
  day.className = "day";
  day.innerHTML = `<label>${label}</label>`;
  day.setAttribute("timestamp", new Date(data.year, parseInt(data.month, 10) - 1, parseInt(data.day, 10)).getTime());
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
<span class="atbats status">at-bats</span>
  `;
  day.appendChild(gameElement);
  return gameElement;
};

ipc.on("update", function(sender, e) {
  if (e.games && e.games.length) {
    if (e.type == "finished-day") {
      var day = days.querySelector(`[day="${getDayID(e)}"]`);
      if (!day) return;
      day.classList.add("finished");
    } else makeDay(e);
  }
  if (e.game) {
    var element = getGameElement(e.game);
    element.classList.add(e.type);
  }
});

window.addEventListener("keydown", function(e) {
  if (e.keyCode == 192) {
    require("remote").getCurrentWindow().webContents.openDevTools();
  }
});