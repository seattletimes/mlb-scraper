var scraper = require("./scrape");
var dateGen = require("./dateGenerator");
var minimist = require("minimist");
var args = minimist(process.argv.slice(2));

var startDate = args.start || "2-2008";
startDate = startDate.split(/\/|-/).map(n => parseInt(n, 10));
var months = [...dateGen.months(startDate[1], startDate[0], 2016, 1)];

if (process.versions.electron) {
  var electron = require("electron");
  var app = electron.app;
  var Window = electron.BrowserWindow;
  var window;
  var ipc = electron.ipcMain;

  app.on("ready", function() {
    window = new Window({
      width: 1024,
      height: 800,
      title: "Bases Loaded"
    });
    window.loadURL(`file://${__dirname}/index.html`);
    window.show();
    if (process.argv.some(arg => arg.match(/--debug/))) window.webContents.openDevTools();

    scraper.on("update", e => window.webContents.send("update", e));

    window.webContents.on("dom-ready", function() {
      scraper.scrape(months);
    });
  });

} else {
  scraper.on("update", e => console.log(e));
  scraper.scrape(months);
}