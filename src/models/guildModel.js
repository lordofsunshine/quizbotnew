const mongoose = require('mongoose');

const auctionItemSchema = new mongoose.Schema({
    role: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    description: { type: String, default: null }
}, { _id: false });

const guildSchema = new mongoose.Schema({
    guild_id: { type: String, required: true, unique: true, index: true },
    random_quiz_channel: { type: String, default: '' },
    random_quiz_interval: { type: Number, default: 0 },
    auction: {
        list: { type: [auctionItemSchema], default: [] }
    },
    premium: {
        enabled: { type: Boolean, default: false },
        time: { type: Number, default: 0 }
    },
    rolePing: { type: String, default: null },
    cooldown: { type: Number, default: 0 }
});

module.exports = mongoose.model('Guild', guildSchema);
