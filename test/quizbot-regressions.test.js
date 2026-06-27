const assert = require('node:assert/strict');
const test = require('node:test');

const { parseAuctionPrice, getAuctionItemByInput } = require('../src/utils/auction');
const { createAnswerOptions, findAnswerByCustomId } = require('../src/utils/answerOptions');
const { recordQuizAnswer } = require('../src/utils/scoring');

test('цена аукциона должна быть положительным целым числом', () => {
    assert.equal(parseAuctionPrice('25'), 25);
    assert.throws(() => parseAuctionPrice('-5'), /положительным целым числом/);
    assert.throws(() => parseAuctionPrice('0'), /положительным целым числом/);
    assert.throws(() => parseAuctionPrice('10.5'), /положительным целым числом/);
    assert.throws(() => parseAuctionPrice('abc'), /положительным целым числом/);
});

test('номер товара аукциона должен указывать на существующий элемент', () => {
    const list = [{ role: 'role-1', price: 10 }, { role: 'role-2', price: 20 }];

    assert.deepEqual(getAuctionItemByInput(list, '2'), { item: list[1], index: 1 });
    assert.throws(() => getAuctionItemByInput(list, '0'), /товар не найден/);
    assert.throws(() => getAuctionItemByInput(list, '3'), /товар не найден/);
    assert.throws(() => getAuctionItemByInput(list, '1abc'), /номер товара/);
});

test('ответы викторины используют безопасные customId вместо текста ответа', () => {
    const longAnswer = 'Очень длинный вариант ответа '.repeat(10);
    const options = createAnswerOptions(['Верный ответ', longAnswer], 'Верный ответ');

    assert.equal(options.length, 2);
    assert.equal(options[0].customId, 'quiz_answer:0');
    assert.equal(options[0].label, 'Верный ответ');
    assert.ok(options[1].label.length <= 80);
    assert.equal(findAnswerByCustomId(options, 'quiz_answer:0').answer, 'Верный ответ');
    assert.equal(findAnswerByCustomId(options, longAnswer), null);
});

test('авто-викторина начисляет очки только за правильный ответ', () => {
    const user = { points: 0, correct_answers: [], incorrect_answers: [] };

    const wrongPoints = recordQuizAnswer(user, {
        isCorrect: false,
        question: 'Столица Франции?',
        category: 'Geography',
        difficulty: 'easy',
        multiplier: 1.5
    });

    assert.equal(wrongPoints, 0);
    assert.equal(user.points, 0);
    assert.equal(user.correct_answers.length, 0);
    assert.equal(user.incorrect_answers.length, 1);

    const correctPoints = recordQuizAnswer(user, {
        isCorrect: true,
        question: 'Столица Франции?',
        category: 'Geography',
        difficulty: 'easy',
        multiplier: 1.5
    });

    assert.equal(correctPoints, 1.5);
    assert.equal(user.points, 1.5);
    assert.equal(user.correct_answers.length, 1);
    assert.equal(user.incorrect_answers.length, 1);
});
