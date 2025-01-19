const db = require('./db');
const fs = require('fs');

// Configuration
const MONTHS_LOOKBACK = 6;

/**
 * Get all novice debaters from the All_Debaters document
 * @returns {Promise<Array>} Array of novice debater objects with their IDs
 */
async function getNoviceDebaters() {
    const snapshot = await db.collection('Debaters').doc('All_Debaters').get();
    const data = snapshot.data();
    
    return Object.entries(data)
        .filter(([_, debater]) => debater.rank === 'Junior')
        .map(([debaterId, debater]) => ({
            ...debater,
            debaterId // Add the ID (key) to the object
        }));
}

/**
 * Get events within the specified time range
 * @param {number} monthsLookback Number of months to look back
 * @returns {Promise<Array>} Array of event objects with their IDs
 */
async function getRecentEvents(monthsLookback) {
    const currentTime = new Date();
    const lookbackTime = new Date();
    lookbackTime.setMonth(currentTime.getMonth() - monthsLookback);

    const snapshot = await db.collection('Events')
        .where('time', '>=', lookbackTime)
        .where('time', '<=', currentTime)
        .get();

    return snapshot.docs.map(doc => ({
        ...doc.data(),
        eventId: doc.id // Add the document ID to the object
    }));
}

/**
 * Get feedback for a specific event
 * @param {string} eventId The event ID
 * @returns {Promise<Object|null>} The feedback data or null if not found
 */
async function getEventFeedback(eventId) {
    const feedbackDoc = await db.collection('Feedbacks').doc(eventId).get();
    return feedbackDoc.exists ? feedbackDoc.data() : null;
}

/**
 * Process a batch of events and collect their feedback
 * @param {Array} events Batch of events to process
 * @param {Object} debaterIdToName Mapping of debater IDs to names
 * @returns {Promise<Array>} Array of processed feedback entries
 */
async function processEventBatch(events, debaterIdToName) {
    const feedbackPromises = events.map(async (event) => {
        const feedback = await getEventFeedback(event.eventId);
        if (!feedback) return [];

        return Object.entries(feedback)
            .filter(([debaterId]) => debaterIdToName[debaterId])
            .map(([debaterId, feedbackDetails]) => ({
                debaterName: debaterIdToName[debaterId],
                event_time: feedbackDetails.event?.time || event.time,
                score: feedbackDetails.score || null,
                positive_feedback: feedbackDetails.positive_feedback || '',
                negative_feedback: feedbackDetails.negative_feedback || '',
                notes: feedbackDetails.notes || ''
            }));
    });

    const results = await Promise.all(feedbackPromises);
    return results.flat();
}

/**
 * Process feedback data for novice debaters
 * @param {Array} noviceDebaters Array of novice debater objects
 * @param {Array} events Array of event objects
 * @returns {Promise<Object>} Processed feedback data
 */
async function processFeedback(noviceDebaters, events) {
    // Initialize feedback data structure
    const feedbackData = {};
    noviceDebaters.forEach(debater => {
        feedbackData[debater.full_name_eng] = {
            average_score: 0,
            events: []
        };
    });

    // Create debater ID to name mapping
    const debaterIdToName = {};
    noviceDebaters.forEach(debater => {
        debaterIdToName[debater.debaterId] = debater.full_name_eng;
    });

    // Process events in parallel batches
    const BATCH_SIZE = 10;
    const batches = [];
    
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
        batches.push(events.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches of events...`);
    
    const batchResults = await Promise.all(
        batches.map(batch => processEventBatch(batch, debaterIdToName))
    );

    // Aggregate results
    const allFeedback = batchResults.flat();

    // Group feedback by debater
    allFeedback.forEach(entry => {
        const debaterData = feedbackData[entry.debaterName];
        if (debaterData) {
            debaterData.events.push({
                event_time: entry.event_time,
                score: entry.score,
                positive_feedback: entry.positive_feedback,
                negative_feedback: entry.negative_feedback,
                notes: entry.notes
            });
        }
    });

    // Calculate average scores and filter out debaters with no feedback
    const filteredFeedbackData = {};
    
    Object.entries(feedbackData).forEach(([debaterName, debaterData]) => {
        if (debaterData.events.length === 0) {
            return; // Skip debaters with no feedback
        }

        const scores = debaterData.events
            .map(event => event.score)
            .filter(score => score !== null);
            
        debaterData.average_score = scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0;

        filteredFeedbackData[debaterName] = debaterData;
    });

    return filteredFeedbackData;
}

/**
 * Main function to collect and process feedback
 */
async function collectFeedback() {
    try {
        console.log('Starting feedback collection...');
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync('output')) {
            await fs.promises.mkdir('output');
        }

        // Get novice debaters and recent events
        const noviceDebaters = await getNoviceDebaters();
        const events = await getRecentEvents(MONTHS_LOOKBACK);

        console.log(`Found ${noviceDebaters.length} novice debaters`);
        console.log(`Found ${events.length} events in the last ${MONTHS_LOOKBACK} months`);

        // Process feedback
        const feedbackData = await processFeedback(noviceDebaters, events);

        // Write results to file
        await fs.promises.writeFile(
            'output/novice_feedback.json', 
            JSON.stringify(feedbackData, null, 2),
            'utf8'
        );

        console.log('Feedback collection complete');
        console.log('Results written to output/novice_feedback.json');

    } catch (error) {
        console.error('Error during feedback collection:', error);
    }
}

// Export functions for potential reuse
module.exports = {
    collectFeedback,
    getNoviceDebaters,
    getRecentEvents,
    getEventFeedback,
    processFeedback
};

// Run if called directly
if (require.main === module) {
    collectFeedback();
}