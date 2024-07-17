const { getEvents, getDebaters } = require('./events');
const { loadLocalJsonFile } = require('./attendance');
const fs = require('fs');
const { Month } = require('./enums');
const xlsx = require('xlsx');

const startDate = new Date(2022, Month.September, 1);
const endDate = new Date(2024, Month.July, 17);
const myDebateSociety = "HUJI";

(async function main() {
    try {
        console.log("Starting...");
        await setupOutputDirectory();
        await retrieveData();
        const events = await loadLocalJsonFile('output/events.json');
        const debaters = await loadLocalJsonFile('output/debaters.json');
        if (events && debaters) {
            console.log("Generating rounds JSON...");
            const roundsJson = await generateRoundsJson(events, debaters, startDate, endDate, myDebateSociety);
            console.log("Generating rounds Excel...");
            await generateRoundsExcel(roundsJson);
        }
    } catch (error) {
        console.error("Error during execution:", error);
    }
})();

async function setupOutputDirectory() {
    if (!fs.existsSync('output')) {
        await fs.mkdir('output');
    }
}

async function retrieveData() {
    if (!fs.existsSync('output/events.json')) {
        console.log("Retrieving events...");
        await getEvents();
    }
    if (!fs.existsSync('output/debaters.json')) {
        console.log("Retrieving debaters...");
        await getDebaters();
    }
    console.log("Data retrieval complete");
}

function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

async function generateRoundsJson(events, debaters, startDate, endDate, societyId) {
    const roundsData = events
        .filter(event => event.time._seconds * 1000 > startDate.getTime() && event.time._seconds * 1000 < endDate.getTime())
        .map(event => {
            const date = new Date(event.time._seconds * 1000);
            const participants = debaters
                .filter(it => it.club == societyId)
                .filter(it => it.id in event.registrations)
                .filter(it => !event.registrations[it.id].cancelledOnTime)
                .filter(it => !event.registrations[it.id].cancelled)
                .map(debater => debater.full_name_heb); // Assuming full_name_eng is available for English names
            return {
                roundName: [event.event_subject, event.event_type, formatDate(date)].filter(it => it).join(' '),
                date: formatDate(date),
                time: date.toLocaleTimeString(),
                roundId: event.id,
                participants
            };
        })
        .filter(round => round.participants.length > 0);

    const roundsJson = {};
    roundsData.forEach(round => {
        roundsJson[round.roundName] = {
            date: round.date,
            time: round.time,
            roundId: round.roundId,
            participants: round.participants
        };
    });

    await fs.promises.writeFile('output/rounds.json', JSON.stringify(roundsJson, null, 2), 'utf8');
    console.log("Rounds JSON generation complete");
    return roundsJson;
}

async function generateRoundsExcel(roundsJson) {
    const roundsArray = Object.keys(roundsJson).map(key => {
        const round = roundsJson[key];
        return {
            "שם הסיבוב": key,
            "תאריך": round.date,
            "שעה": round.time,
            "DB ID": round.roundId,
            "משתתפים": round.participants.join(", ")
        };
    });

    const ws = xlsx.utils.json_to_sheet(roundsArray);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Rounds');

    xlsx.writeFile(wb, 'output/rounds.xlsx');
    console.log("Rounds Excel generation complete");
}

module.exports = { generateRoundsJson, generateRoundsExcel };
