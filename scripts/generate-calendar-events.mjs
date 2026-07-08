import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const calendars = [
  {
    group: "Hey!Mommy!",
    url: "https://calendar.google.com/calendar/ical/heymommy11111%40gmail.com/public/basic.ics",
  },
  {
    group: "SCRAMBLE SMILE",
    url: "https://calendar.google.com/calendar/ical/info%40scramblesmile.jp/public/basic.ics",
  },
];
const holidayCalendar = {
  group: "日本の祝日",
  url: "https://calendar.google.com/calendar/ical/ja.japanese%23holiday%40group.v.calendar.google.com/public/basic.ics",
};

const today = startOfDay(new Date());
const minDate = addDays(today, -180);
const maxDate = addDays(today, 540);
const outputPath = path.resolve("public", "calendar-events.json");

const calendarsWithEvents = await Promise.all(
  calendars.map(async (calendar) => {
    const response = await fetch(calendar.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${calendar.group}: ${response.status}`);
    }
    const icsText = await response.text();
    const events = parseIcsCalendar(icsText, calendar.group, calendar.url).filter((event) => {
      const date = toDate(event.date);
      return date >= minDate && date <= maxDate;
    });
    return { ...calendar, events };
  }),
);
const holidayResponse = await fetch(holidayCalendar.url);
if (!holidayResponse.ok) {
  throw new Error(`Failed to fetch holidays: ${holidayResponse.status}`);
}
const holidays = parseIcsCalendar(await holidayResponse.text(), holidayCalendar.group, holidayCalendar.url).filter((event) => {
  const date = toDate(event.date);
  return date >= minDate && date <= maxDate;
});

const payload = {
  generatedAt: new Date().toISOString(),
  calendars: calendarsWithEvents,
  holidays,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(
  `Generated ${outputPath}: ${calendarsWithEvents
    .map((calendar) => `${calendar.group} ${calendar.events.length}`)
    .join(", ")}, holidays ${holidays.length}`,
);

function parseIcsCalendar(icsText, groupName, sourceUrl) {
  const lines = icsText.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let currentEvent = null;

  lines.forEach((line) => {
    if (line === "BEGIN:VEVENT") {
      currentEvent = [];
      return;
    }
    if (line === "END:VEVENT") {
      if (currentEvent) events.push(currentEvent);
      currentEvent = null;
      return;
    }
    if (currentEvent) currentEvent.push(line);
  });

  return events.flatMap((eventLines) => {
    const summary = getIcsValue(eventLines, "SUMMARY");
    const start = getIcsValue(eventLines, "DTSTART");
    if (!summary || !start) return [];
    const uid = getIcsValue(eventLines, "UID") || `${summary}-${start}`;
    const location = getIcsValue(eventLines, "LOCATION");
    const parsedStart = parseIcsDateTime(start);
    if (!parsedStart) return [];

    return [
      {
        id: `external-${groupName}-${uid}`,
        group: groupName,
        date: parsedStart.date,
        time: parsedStart.time,
        title: unescapeIcsText(summary),
        location: location ? unescapeIcsText(location) : "",
        sourceUrl,
      },
    ];
  });
}

function getIcsValue(lines, name) {
  const line = lines.find((currentLine) => currentLine.startsWith(`${name}:`) || currentLine.startsWith(`${name};`));
  return line?.slice(line.indexOf(":") + 1) ?? "";
}

function parseIcsDateTime(value) {
  if (/^\d{8}$/.test(value)) {
    return { date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, time: "" };
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!match) return null;
  if (value.endsWith("Z")) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])));
    return {
      date: toIsoDate(date),
      time: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
    };
  }
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

function unescapeIcsText(value) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
