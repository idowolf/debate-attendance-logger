const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json'); // Add a service account json file from https://console.firebase.google.com/u/0/project/YOURPROJECTHERE/settings/serviceaccounts/adminsdk
let fs = require('fs');
let Month = require("./months");

/** 
 * Change configurations below to suit your needs 
 */
const startDate = new Date(2024, Month.February, 1);
const endDate = new Date(2024, Month.April, 1);
const myDebateSociety = "IDC";

/**
 * Function prototypes and helpers
 */
Array.prototype.unique = function () {
    var a = this.concat();
    for (var i = 0; i < a.length; ++i) {
        for (var j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }

    return a;
};



/**
 * Global firebase init code
 */
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
let db = admin.firestore();


/**
 * Function to retrieve events from Firestore and save them to a local JSON file
 */
async function getEvents() {
    let snapshot = await db.collection('Events').get();
    let docs = snapshot.docs.map(doc => { return { id: doc.id, ...doc.data() } });
    let promises = [];
    docs.forEach(event => {
        let eventData = db
            .collection("Events")
            .doc(event.id)
            .collection("EventData");
        promises.push(new Promise((resolve, reject) => {
            eventData.doc("Assignments")
                .get()
                .then((assignmentsDoc) => {
                    docs.find(elem => elem.id == event.id)["assignments"] = assignmentsDoc.data() || {};
                    resolve();
                })
                .catch(err => {
                    reject(err);
                })
        }))
        promises.push(new Promise((resolve, reject) => {
            eventData.doc("Registrations")
                .get()
                .then((assignmentsDoc) => {
                    docs.find(elem => elem.id == event.id)["registrations"] = assignmentsDoc.data() || {};
                    resolve();
                })
                .catch(err => {
                    reject(err);
                })
        }))
    })
    await Promise.all(promises)
    await fs.promises.writeFile('output/events.json', JSON.stringify(docs), 'utf8');
}

/**
 * Function to retrieve debaters from Firestore and save them to a local JSON file
 */
async function getDebaters() {
    try {
        let snapshot = await db.collection('Debaters').get();
        let docs = snapshot.docs.map(doc => { return { "id": doc.id, ...doc.data() } });
        await fs.promises.writeFile('output/debaters.json', JSON.stringify(docs), 'utf8');
    } catch (e) {
        console.log(e);
    }
}

/**
 * Function to load a local JSON file
 */
async function loadLocalJsonFile(filePath) {
    try {
        let data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.log(err);
        return null;
    }
}

/**
 * Function to calculate attendance based on events and debaters data and save it to local TSV files
 */
async function calculateAttendance(events, debaters) {
    let dates = events
        .filter(event => startDate.getTime() / 1000 < event.time._seconds)
        .filter(event => endDate.getTime() / 1000 > event.time._seconds)
        .sort(function (a, b) {
            return a.time._seconds - b.time._seconds;
        })
        .map(event => {
            const dateInMillis = event.time._seconds * 1000
            let time = new Date(dateInMillis)
            let participants = debaters
                .filter(it => it.club == myDebateSociety)
                .filter(it => it.id in event.registrations)
                .filter(it => !event.registrations[it.id].cancelledOnTime)
                .filter(it => !event.registrations[it.id].cancelled)
                .map(it => it.full_name_heb)
            return { timestamp: event.time._seconds, date: time.toLocaleDateString(), time: time.toLocaleTimeString(), participants: participants };
        })


    let dateRangesToNames = {};
    let initialDate = startDate
    let lastDate = new Date(initialDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    while (initialDate.getTime() < endDate.getTime()) {
        let entries = dates
            .filter(it => it.timestamp > initialDate.getTime() / 1000)
            .filter(it => it.timestamp <= lastDate.getTime() / 1000)
        let participantsArr = [];
        entries.forEach(entry => {
            participantsArr = [...participantsArr, ...entry.participants];
        })
        dateRangesToNames[initialDate.toLocaleDateString() + "-" + lastDate.toLocaleDateString()] = participantsArr.unique();
        initialDate = lastDate
        lastDate = new Date(initialDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    let namesToPercent = {};
    Object.values(dateRangesToNames).forEach(dateRange => {
        dateRange.forEach(name => {
            namesToPercent[name] = (namesToPercent[name] || 0) + 1;
        })
    })
    namesToPercent = Object.entries(namesToPercent)
        .sort((a, b) => {
            return b[1] - a[1];
        })

    namesToPercent = Object.fromEntries(namesToPercent);
    let weeksCount = Object.values(dateRangesToNames)
        .filter(x => x.length > 0)
        .length
    for (const [key, val] of Object.entries(namesToPercent)) {
        namesToPercent[key] = (val / weeksCount) * 100;
    }
    for (const [key, val] of Object.entries(dateRangesToNames)) {
        dateRangesToNames[key] = val.join(", ");
    }

    let datesCsv = ""
    for (let key in dateRangesToNames) {
        let text = dateRangesToNames[key] != "" ? dateRangesToNames[key] : "לא היו אימונים בשבוע זה"
        datesCsv += `${key}\t${text}\n`;
    }
    let namesToPercentCsv = ""
    for (let key in namesToPercent) {
        namesToPercentCsv += `${key}\t${namesToPercent[key]}\n`;
    }
    await fs.promises.writeFile('output/dates.tsv', datesCsv, 'utf8');
    await fs.promises.writeFile('output/namesToPercent.tsv', namesToPercentCsv, 'utf8');
}

/**
 * Main function
 */
(async function () {
    console.log("Starting...");
    if (!fs.existsSync('output')) {
        fs.mkdirSync('output');
    }
    if (!fs.existsSync('output/events.json')) {
        console.log("Retrieving events...");
        await getEvents();
    }
    if (!fs.existsSync('output/debaters.json')) {
        console.log("Retrieving debaters...");
        await getDebaters();
    }
    console.log("Data retrieval complete");
    let events = await loadLocalJsonFile('output/events.json');
    let debaters = await loadLocalJsonFile('output/debaters.json');
    if (events && debaters) {
        console.log("Calculating attendance...");
        await calculateAttendance(events, debaters);
    }
})();
