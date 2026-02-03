const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  pushSubscription: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  location: {
    latitude: Number,
    longitude: Number,
    name: String // e.g., "Seoul, Korea"
  },
  notificationSettings: {
    enabled: { type: Boolean, default: true },
    alertTime: { type: String, default: "20:00" }, // 24h format
    minSeeing: { type: Number, default: 3 } // Minimum seeing quality to notify (1-5)
  },
  deviceType: String // e.g., "mobile", "desktop"
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
