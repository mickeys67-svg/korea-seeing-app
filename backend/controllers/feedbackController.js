const mongoose = require('mongoose');

/**
 * POST /api/feedback
 * Receive user observation feedback and update matching TrainingData
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

        let TrainingData;
        try {
            TrainingData = mongoose.model('TrainingData');
        } catch {
            return res.status(503).json({ error: 'Training data model not available' });
        }

        // Find the closest matching TrainingData document
        // Search within ±0.5° lat/lon and ±3 hours of the given timestamp
        const targetTime = new Date(timestamp);
        const timeWindow = 3 * 60 * 60 * 1000; // 3 hours in ms

        const doc = await TrainingData.findOne({
            lat: { $gte: parsedLat - 0.5, $lte: parsedLat + 0.5 },
            lon: { $gte: parsedLon - 0.5, $lte: parsedLon + 0.5 },
            timestamp: {
                $gte: new Date(targetTime.getTime() - timeWindow),
                $lte: new Date(targetTime.getTime() + timeWindow),
            },
        }).sort({ timestamp: -1 }); // Most recent match

        if (!doc) {
            // No matching prediction found, but still record as standalone feedback
            return res.status(200).json({
                success: true,
                matched: false,
                message: 'Feedback received but no matching prediction found',
            });
        }

        // Update the actual feedback fields
        doc.actual = {
            rating: r,
            actualSeeing: actualSeeing != null ? parseFloat(actualSeeing) : undefined,
            comment: comment || undefined,
            feedbackAt: new Date(),
        };

        await doc.save();

        res.status(200).json({
            success: true,
            matched: true,
            predictedScore: doc.predicted?.score,
            message: 'Feedback recorded successfully',
        });
    } catch (err) {
        console.error('[Feedback] Error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { submitFeedback };
