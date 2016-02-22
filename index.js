var scraper = require("./scrape");

if (process.versions.electron) {
  var electron = require("electron");
  var app = electron.app;
  var Window = electron.BrowserWindow;
  var window;
  var ipc = electron.ipcMain;

  app.on("ready", function() {
    window = new Window({ width: 800, height: 600 });
    window.loadURL(`file://${__dirname}/index.html`);
    window.show();
    window.webContents.openDevTools();

    scraper.on("update", e => window.webContents.send("update", e));

    window.webContents.on("dom-ready", function() {
      scraper.scrape();
    });
  });

} else {
  scraper.on("update", e => console.log(e.type, e.game ? e.game.id : e.games.length + " games"));
  scraper.scrape();
}