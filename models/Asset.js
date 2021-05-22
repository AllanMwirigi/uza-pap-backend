const mongoose = require('mongoose');
const { Schema } = mongoose;

const assetSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: Number, default: -1 }
});

const Asset = mongoose.model('asset', assetSchema);
module.exports = Asset;