const { emojis } = require('../misc');

function getCategoryEmoji(category) {
    const normalized = String(category ?? '').toLowerCase();
    for (const [key, value] of Object.entries(emojis.categories)) {
        if (normalized.startsWith(key)) return value;
    }

    return '❓';
}

function capitalizeFirstLetter(string) {
    const value = String(string ?? '');
    return value.charAt(0).toUpperCase() + value.slice(1);
}

module.exports = { getCategoryEmoji, capitalizeFirstLetter };
