var longMonths = [1, 3, 5, 7, 8, 10, 12];

var now = new Date();

var days = function*(year, month, day) {
  while (true) {
    yield { year, month, day }
    day++;
    if (
        (month == 2 && day > 29) || //leap years
        (month == 2 && year % 4 && day > 28) || //regular years
        (day > 30 && longMonths.indexOf(month) == -1) || //short months
        day > 31 //everything else
      ) {
      day = 1;
      month++;
    }
    if (month > 12) {
      month = 1;
      year++;
    }
  }
};

var months = function*(year, month, endYear, endMonth) {
  endYear = endYear || now.getFullYear() + 1;
  endMonth = endMonth || now.getMonth() + 2;
  while (year < endYear) {
    if (year == endYear && month > endMonth) return;
    yield { year, month };
    month++;
    if (month > 12) {
      year++;
      month = 1;
    }
  }
}

module.exports = { days, months };