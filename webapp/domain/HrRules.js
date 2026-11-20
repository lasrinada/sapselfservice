sap.ui.define(["./Calendar"], function (Calendar) {
    "use strict";

    function quota(state, user, year, includePending) {
        const used = state.absences.filter((row) => row.employeeId === user.id && row.typeId === "vacation" &&
            row.from.startsWith(year) && (row.status === "Genehmigt" ||
                (includePending && row.status === "In Bearbeitung")));
        return Math.max(0, 20 * user.factor - used.reduce((sum, row) => sum + row.vacationDays, 0));
    }

    function approver(state, user, today) {
        const managerId = state.departments.find((row) => row.id === user.departmentId)?.managerId;
        const managerAbsent = state.absences.some((row) => row.employeeId === managerId &&
            row.typeId === "vacation" && row.status === "Genehmigt" && row.from <= today && row.to >= today);
        return state.employees.find((row) => managerId && managerId !== user.id && !managerAbsent ?
            row.id === managerId : row.role === "ceo");
    }

    function absence(state, user, input, today) {
        const type = state.absenceTypes.find((row) => row.id === input.typeId);
        const start = Calendar.parse(input.from);
        const end = Calendar.parse(input.to);
        if (!type || !start || !end || input.to < input.from) throw new Error("Bitte einen gültigen Zeitraum auswählen.");
        if (input.range && !type.range) throw new Error("Bitte einen einzelnen Tag auswählen.");
        if (type.id === "vacation" && (input.from <= today || input.from.slice(0, 4) !== input.to.slice(0, 4))) {
            throw new Error("Bitte Urlaub ab morgen und innerhalb eines Kalenderjahres auswählen.");
        }
        const workingDay = Calendar.isWeekday(start);
        const hours = (Calendar.minutes(input.end) - Calendar.minutes(input.start)) / 60;
        let vacationDays = 0;
        if (input.range) {
            vacationDays = Calendar.weekdays(input.from, input.to) * user.factor;
            if (!vacationDays) throw new Error("Der Zeitraum muss mindestens einen Arbeitstag enthalten.");
        } else {
            if (input.from !== input.to || !(hours > 0)) throw new Error("Bitte Beginn und Ende des Tages korrekt angeben.");
            if (type.id === "remote-weekend" ? workingDay : !workingDay) {
                throw new Error(type.id === "remote-weekend" ?
                    "Bitte Samstag oder Sonntag auswählen." : "Bitte Montag bis Freitag auswählen.");
            }
            if (type.id === "vacation") vacationDays = user.factor === 0.5 || hours <= 4 ? 0.5 : 1;
        }
        const remaining = quota(state, user, input.from.slice(0, 4), true);
        if (vacationDays > remaining) throw new Error("Verfügbares Urlaubskontingent: " + remaining + " Tage.");
        return {
            employeeId: user.id, typeId: type.id, from: input.from, to: input.to,
            start: input.range ? "" : input.start, end: input.range ? "" : input.end,
            note: String(input.note || "").trim().slice(0, 200), vacationDays,
            requestedOn: today, status: "In Bearbeitung"
        };
    }

    function duration(entry) {
        const start = Calendar.minutes(entry.session1Start);
        const end = Calendar.minutes(entry.session1End);
        const second = Boolean(entry.session2Start || entry.session2End);
        const nextStart = Calendar.minutes(entry.session2Start);
        const nextEnd = Calendar.minutes(entry.session2End);
        if (!(start < end) || (second && !(end <= nextStart && nextStart < nextEnd))) {
            throw new Error("Bitte vollständige Arbeitszeiten in zeitlicher Reihenfolge eingeben.");
        }
        return {
            hours: (end - start + (second ? nextEnd - nextStart : 0)) / 60,
            pause: second ? (nextStart - end) / 60 : 0
        };
    }

    function profile(input, group) {
        if (group === "bank") {
            const IBAN = String(input.IBAN || "").replace(/\s/g, "").toUpperCase();
            const BIC = String(input.BIC || "").trim().toUpperCase();
            if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(IBAN)) throw new Error("Bitte eine gültige IBAN eingeben.");
            if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(BIC)) throw new Error("Bitte einen gültigen BIC eingeben.");
            return { IBAN, BIC };
        }
        const fields = ["Vorname", "Nachname", "Straße", "Hausnummer", "Ort", "Postleitzahl", "Geschlecht"];
        const data = Object.fromEntries(fields.map((field) => [field, String(input[field] || "").trim()]));
        if (fields.some((field) => !data[field]) || !/^\d{5}$/.test(data.Postleitzahl)) {
            throw new Error("Bitte alle Pflichtfelder und eine fünfstellige Postleitzahl eingeben.");
        }
        return data;
    }

    return { quota, approver, absence, duration, profile };
});
