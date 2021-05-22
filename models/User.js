const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  email: { type: String, required: true },
  firstname: { type: String, required: true},
  lastname: { type: String, required: true },
  phoneNo: { type: String, required: true},
  password: { type: String, required: true }, // IMPORTANT!!!- this is a hack; please remove if ever proceed with this thing
});

const User = mongoose.model('user', userSchema);
module.exports = User;