const db = require('./db');
const fs = require('fs').promises;

async function getEvents() {
    const snapshot = await db.collection('Events').get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const data = await Promise.all(docs.map(doc => addEventData(doc)));
    await fs.writeFile('output/events.json', JSON.stringify(data), 'utf8');
}

async function addEventData(event) {
    const eventData = await db.collection("Events").doc(event.id).collection("EventData");
    event.assignments = (await (eventData.doc("Assignments").get())).data() || {};
    event.registrations = (await eventData.doc("Registrations").get()).data() || {};
    return event;
}
 
async function getDebaters() {
    const snapshot = await db.collection('Debaters').get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await fs.writeFile('output/debaters.json', JSON.stringify(docs), 'utf8');
}

module.exports = { getEvents, getDebaters }


// promises.push(new Promise((resolve, reject) => {
//     eventData.doc("Assignments")
//         .get()
//         .then((assignmentsDoc) => {
//             docs.find(elem => elem.id == event.id)["assignments"] = assignmentsDoc.data() || {};
//             resolve();
//         })
//         .catch(err => {
//             reject(err);
//         })
// }))

// let eventData = db
// .collection("Events")
// .doc(event.id)
// .collection("EventData");
// promises.push(new Promise((resolve, reject) => {
// eventData.doc("Assignments")