const { getEvents, getDebaters } = require('./events');
const { loadLocalJsonFile, calculateAttendance } = require('./attendance');
const fs = require('fs');
const { Month } = require('./enums');

const startDate = new Date(2024, Month.February, 1);
const endDate = new Date(2024, Month.April, 1);
const myDebateSociety = "IDC";

(async function main() {
    try {
        console.log("Starting...");
        await setupOutputDirectory();
        await retrieveData();
        const events = await loadLocalJsonFile('output/events.json');
        const debaters = await loadLocalJsonFile('output/debaters.json');
        if (events && debaters) {
            console.log("Calculating attendance...");
            await calculateAttendance(events, debaters, startDate, endDate, myDebateSociety);
        }
    } catch (error) {
        console.error("Error during execution:", error);
    }
})();

async function setupOutputDirectory() {
    if (!fs.existsSync('output')) {
        await fs.mkdirSync('output');
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
