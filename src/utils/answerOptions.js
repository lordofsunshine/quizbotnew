const MAX_BUTTON_LABEL_LENGTH = 80;

function trimButtonLabel(answer) {
    const text = String(answer ?? '').trim() || 'Пустой ответ';
    if (text.length <= MAX_BUTTON_LABEL_LENGTH) return text;
    return `${text.slice(0, MAX_BUTTON_LABEL_LENGTH - 1)}…`;
}

function createAnswerOptions(answers, correctAnswer) {
    return answers.map((answer, index) => ({
        answer,
        customId: `quiz_answer:${index}`,
        label: trimButtonLabel(answer),
        isCorrect: answer === correctAnswer
    }));
}

function findAnswerByCustomId(options, customId) {
    return options.find((option) => option.customId === customId) || null;
}

module.exports = { createAnswerOptions, findAnswerByCustomId, trimButtonLabel };
