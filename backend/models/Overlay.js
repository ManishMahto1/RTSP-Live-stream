const mongoose = require('mongoose');

const overlaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'logo', 'image'], required: true },
  content: { type: String, required: true },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  size: {
    width: { type: Number, default: 100 },
    height: { type: Number, default: 50 }
  },
  style: {
    fontSize: { type: Number, default: 16 },
    color: { type: String, default: '#ffffff' },
    backgroundColor: { type: String, default: 'transparent' },
    opacity: { type: Number, default: 1 }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Overlay', overlaySchema);