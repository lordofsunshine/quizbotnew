const emojis = {
    categories: {
        'general knowledge': '🧠',
        entertainment: '🎬',
        'science & nature': '🌱',
        science: '🧪',
        mythology: '🏛️',
        sports: '⚽',
        geography: '🗺️',
        history: '📜',
        politics: '👔',
        art: '🎨',
        celebrities: '🎤',
        animals: '🐾',
        vehicles: '🚗'
    },
    difficulty: {
        easy: '🙂',
        medium: '😐',
        hard: '😵'
    }
};

const trivia_categories = [
    { id: 9, name: 'Общие знания' },
    { id: 10, name: 'Книги' },
    { id: 11, name: 'Фильмы' },
    { id: 12, name: 'Музыка' },
    { id: 13, name: 'Мюзиклы и театры' },
    { id: 14, name: 'Телевидение' },
    { id: 15, name: 'Видеоигры' },
    { id: 16, name: 'Настольные игры' },
    { id: 17, name: 'Наука и природа' },
    { id: 18, name: 'Наука: компьютеры' },
    { id: 19, name: 'Математика' },
    { id: 20, name: 'Мифология' },
    { id: 21, name: 'Спорт' },
    { id: 22, name: 'География' },
    { id: 23, name: 'История' },
    { id: 24, name: 'Политика' },
    { id: 25, name: 'Искусство' },
    { id: 26, name: 'Знаменитости' },
    { id: 27, name: 'Животные' },
    { id: 28, name: 'Машины' },
    { id: 29, name: 'Комиксы' },
    { id: 30, name: 'Наука: гаджеты' },
    { id: 31, name: 'Аниме' },
    { id: 32, name: 'Мультфильмы' }
];

module.exports = { emojis, trivia_categories };
