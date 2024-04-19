const fs = require('fs').promises;

/**
 * Load a local JSON file and parse it.
 * @param {string} filePath Path to the JSON file.
 * @returns {Promise<Object|null>} The parsed JSON object or null if an error occurs.
 */
async function loadLocalJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error loading JSON file ${filePath}: ${err}`);
        return null;
    }
}

/**
 * Calculate attendance data and write the results to output files.
 * @param {Array} events Array of event objects.
 * @param {Array} debaters Array of debater objects.
 * @param {Date} startDate Start date for attendance calculations.
 * @param {Date} endDate End date for attendance calculations.
 * @param {string} societyId ID of the society to filter participants.
 * @returns {Promise<void>}
 */
async function calculateAttendance(events, debaters, startDate, endDate, societyId) {
    const attendanceData = events
        .filter(event => event.time._seconds * 1000 > startDate.getTime() && event.time._seconds * 1000 < endDate.getTime())
        .map(event => {
            const date = new Date(event.time._seconds * 1000);
            const participants = debaters
                .filter(debater => debater.club === societyId && event.registrations[debater.id] && !event.registrations[debater.id].cancelled)
                .map(debater => debater.full_name_heb);
            return {
                timestamp: event.time._seconds,
                date: date.toLocaleDateString(),
                time: date.toLocaleTimeString(),
                participants
            };
        });

    // Generate weekly summaries
    const results = summarizeWeekly(attendanceData, startDate, endDate);

    // Write results to TSV files
    await writeResults(results);
}

/**
 * Summarize attendance data weekly.
 * @param {Array} attendanceData Array of detailed attendance data.
 * @param {Date} startDate Start date for weekly summaries.
 * @param {Date} endDate End date for weekly summaries.
 * @returns {Object} Weekly summaries and participation percentages.
 */
function summarizeWeekly(attendanceData, startDate, endDate) {
    const dateRangesToNames = {};
    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
        const endDateOfWeek = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const weeklyData = attendanceData.filter(event => {
            const eventDate = new Date(event.timestamp * 1000);
            return eventDate >= currentDate && eventDate < endDateOfWeek;
        });

        const weeklyParticipants = weeklyData.reduce((acc, cur) => acc.concat(cur.participants), []);
        dateRangesToNames[`${currentDate.toLocaleDateString()} - ${endDateOfWeek.toLocaleDateString()}`] = [...new Set(weeklyParticipants)];
        currentDate = endDateOfWeek;
    }

    return {
        weeklySummaries: dateRangesToNames,
        participationPercentages: calculateParticipationPercentages(dateRangesToNames)
    };
}

/**
 * Calculate participation percentages.
 * @param {Object} summaries Weekly summaries of participants.
 * @returns {Object} Participation percentages.
 */
function calculateParticipationPercentages(summaries) {
    const counts = {};
    const totalWeeks = Object.values(summaries).length;
    
    Object.values(summaries).forEach(participants => {
        participants.forEach(participant => {
            counts[participant] = (counts[participant] || 0) + 1;
        });
    });

    return Object.fromEntries(
        Object.entries(counts).map(([participant, count]) => [participant, (count / totalWeeks) * 100])
    );
}

/**
 * Write the calculated attendance results to output files.
 * @param {Object} results Attendance results.
 * @returns {Promise<void>}
 */
async function writeResults({ weeklySummaries, participationPercentages }) {
    let datesContent = Object.entries(weeklySummaries)
        .map(([dateRange, participants]) => `${dateRange}\t${participants.length ? participants.join(", ") : "לא היו אימונים בשבוע זה"}\n`)
        .join("");
    let percentagesContent = Object.entries(participationPercentages)
        .sort((a, b) => b[1] - a[1])
        .map(([name, percent]) => `${name}\t${percent.toFixed(2)}%\n`)
        .join("");

    await fs.writeFile('output/dates.tsv', datesContent, 'utf8');
    await fs.writeFile('output/namesToPercent.tsv', percentagesContent, 'utf8');
}

module.exports = { loadLocalJsonFile, calculateAttendance };
