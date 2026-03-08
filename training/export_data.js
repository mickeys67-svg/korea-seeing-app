/**
 * WARP AI — MongoDB TrainingData → CSV Exporter
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node training/export_data.js > training_data.csv
 *
 * For Colab:
 *   1. Run this locally to generate CSV
 *   2. Upload CSV to Google Drive
 *   3. Run train_warp.py in Colab
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const mongoose = require('mongoose');

// Reuse the TrainingData model
require('../backend/models/TrainingData');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not set. Check backend/.env');
    process.exit(1);
}

const FEATURES = [
    'seeing', 'transparency', 'cloudScore', 'wind', 'jetStream',
    'cape', 'humidity', 'temp', 'pm25', 'aod',
    'moonPhase', 'moonFraction',
];

async function exportData() {
    await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
    });

    const TrainingData = mongoose.model('TrainingData');

    // Only export documents that have user feedback
    const cursor = TrainingData.find({
        'actual.rating': { $exists: true, $ne: null },
    }).cursor();

    // CSV Header
    const header = [
        'timestamp', 'lat', 'lon', 'elevation', 'isUrban',
        ...FEATURES,
        'cloudLow', 'cloudMid', 'cloudHigh',
        'predictedScore', 'predictedGrade',
        'actualRating', 'actualSeeing',
    ].join(',');

    // Write to stdout
    process.stdout.write(header + '\n');

    let count = 0;
    for await (const doc of cursor) {
        const row = [
            doc.timestamp?.toISOString() || '',
            doc.lat ?? '',
            doc.lon ?? '',
            doc.elevation ?? 50,
            doc.isUrban ? 1 : 0,
            // Input features
            ...FEATURES.map(f => doc.inputs?.[f] ?? ''),
            // Cloud layers
            doc.layers?.cloudLow ?? '',
            doc.layers?.cloudMid ?? '',
            doc.layers?.cloudHigh ?? '',
            // Predicted
            doc.predicted?.score ?? '',
            doc.predicted?.grade ?? '',
            // Actual feedback
            doc.actual?.rating ?? '',
            doc.actual?.actualSeeing ?? '',
        ].join(',');

        process.stdout.write(row + '\n');
        count++;
    }

    console.error(`[Export] ${count} records exported with user feedback`);

    await mongoose.disconnect();
}

exportData().catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
});
