const mongoose = require('mongoose');
var schema = mongoose.Schema;

let userSchema = new schema({
    name: {type: String, require:true},
    email: {type: String, require:true},
    entryDate: {type: Date, default:Date.now}
})

let users = mongoose.model('users', userSchema, 'users');

module.exports = users;
