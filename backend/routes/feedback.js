const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// Rate limit: 10 feedback submissions per hour per IP
const feedbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many feedback submissions. Please try again later.' },
});

router.post('/feedback', feedbackLimiter, feedbackController.submitFeedback);

module.exports = router;
