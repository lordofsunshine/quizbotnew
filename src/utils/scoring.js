function getDifficultyPoints(difficulty) {
    const normalized = String(difficulty ?? '').toLowerCase();
    if (normalized === 'easy') return 1;
    if (normalized === 'medium') return 3;
    if (normalized === 'hard') return 5;
    return 0;
}

function upsertAnswerStat(stats, question, category) {
    const existing = stats.find((answer) => answer.question === question);
    if (existing) {
        existing.amountOfTimes += 1;
        return;
    }

    stats.push({ question, amountOfTimes: 1, category });
}

function recordQuizAnswer(user, { isCorrect, question, category, difficulty, multiplier = 1 }) {
    if (!user.correct_answers) user.correct_answers = [];
    if (!user.incorrect_answers) user.incorrect_answers = [];

    if (!isCorrect) {
        upsertAnswerStat(user.incorrect_answers, question, category);
        return 0;
    }

    const points = getDifficultyPoints(difficulty) * multiplier;
    user.points = (Number(user.points) || 0) + points;
    upsertAnswerStat(user.correct_answers, question, category);
    return points;
}

module.exports = { getDifficultyPoints, recordQuizAnswer };
