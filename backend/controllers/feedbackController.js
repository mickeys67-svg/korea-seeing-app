/**
 * POST /api/feedback
 * Receive user observation feedback and update matching TrainingData in Firestore
 */
const submitFeedback = async (req, res) => {
    try {
        const { lat, lon, timestamp, rating, actualSeeing, comment } = req.body;

        // Validate required fields
        if (lat == null || lon == null || !timestamp || !rating) {
            return res.status(400).json({ error: 'Missing required fields: lat, lon, timestamp, rating' });
        }

        // Validate rating range
        const r = Number(rating);
        if (!Number.isInteger(r) || r < 1 || r > 5) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
        }

        // Validate coordinates
        const parsedLat = parseFloat(lat);
        const parsedLon = parseFloat(lon);
        if (isNaN(parsedLat) || isNaN(parsedLon) ||
            parsedLat < -90 || parsedLat > 90 ||
            parsedLon < -180 || parsedLon > 180) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        // Validate actualSeeing if provided
        if (actualSeeing != null) {
            const s = parseFloat(actualSeeing);
            if (isNaN(s) || s < 0 || s > 20) {
                return res.status(400).json({ error: 'actualSeeing must be between 0 and 20 arcseconds' });
            }
        }

        // Validate comment length
        if (comment && comment.length > 500) {
            return res.status(400).json({ error: 'Comment must be under 500 characters' });
        }

        const db = req.app.locals.db;
        if (!db) {
            return res.status(503).json({ error: 'Database not available' });
        }

        // Find the closest matching TrainingData document
        // Search within ±3 hours of the given timestamp, then filter ±0.5° lat/lon in code
        const targetTime = new Date(timestamp);
        const timeWindow = 3 * 60 * 60 * 1000; // 3 hours in ms
        const startTime = new Date(targetTime.getTime() - timeWindow);
        const endTime = new Date(targetTime.getTime() + timeWindow);

        const snapshot = await db.collection('trainingData')
            .where('timestamp', '>=', startTime)
            .where('timestamp', '<=', endTime)
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        // Filter by lat/lon in application code (Firestore single-field inequality optimization)
        const matchDoc = snapshot.docs.find(d => {
            const data = d.data();
            return Math.abs(data.lat - parsedLat) <= 0.5
                && Math.abs(data.lon - parsedLon) <= 0.5;
        });

        if (!matchDoc) {
            return res.status(200).json({
                success: true,
                matched: false,
                message: 'Feedback received but no matching prediction found',
            });
        }

        // Update the actual feedback fields
        await matchDoc.ref.update({
            actual: {
                rating: r,
                actualSeeing: actualSeeing != null ? parseFloat(actualSeeing) : null,
                comment: comment || null,
                feedbackAt: new Date(),
            },
        });

        const matchData = matchDoc.data();
        res.status(200).json({
            success: true,
            matched: true,
            predictedScore: matchData.predicted?.score,
            message: 'Feedback recorded successfully',
        });
    } catch (err) {
        console.error('[Feedback] Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { submitFeedback };
