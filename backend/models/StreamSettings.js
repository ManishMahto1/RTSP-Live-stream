const mongoose = require('mongoose');

const streamSettingsSchema = new mongoose.Schema({
  rtspUrl: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  quality: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StreamSettings', streamSettingsSchema);