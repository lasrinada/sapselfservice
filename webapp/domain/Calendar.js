sap.ui.define([], function () {
    "use strict";

    function key(date) {
        if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
        return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
            .map((part, index) => String(part).padStart(index ? 2 : 4, "0")).join("-");
    }

    function parse(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
        const date = new Date(value + "T12:00:00");
        return key(date) === value ? date : null;
    }

    function shift(date, days) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + days);
        return key(copy);
    }

    function months(value, count) {
        const date = parse(value);
        const day = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + count);
        const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(day, last));
        return key(date);
    }

    function weekdays(from, to) {
        const end = parse(to);
        if (!end || !parse(from)) return 0;
        let days = 0;
        for (let date = parse(from); date <= end; date.setDate(date.getDate() + 1)) {
            if (isWeekday(date)) days++;
        }
        return days;
    }

    function isWeekday(date) {
        return date.getDay() > 0 && date.getDay() < 6;
    }

    function minutes(value) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
        const [hour, minute] = value.split(":").map(Number);
        return hour * 60 + minute;
    }

    function display(value) {
        return parse(value)?.toLocaleDateString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric"
        }) || "";
    }

    return { key, parse, shift, months, weekdays, isWeekday, minutes, display };
});
