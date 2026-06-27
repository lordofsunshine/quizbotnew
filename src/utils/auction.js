function parseAuctionPrice(value) {
    const normalized = String(value ?? '').trim();
    if (!/^\d+$/.test(normalized)) {
        throw new Error('Цена должна быть положительным целым числом.');
    }

    const price = Number(normalized);
    if (!Number.isSafeInteger(price) || price <= 0) {
        throw new Error('Цена должна быть положительным целым числом.');
    }

    return price;
}

function getAuctionItemByInput(list, value) {
    const normalized = String(value ?? '').trim();
    if (!/^\d+$/.test(normalized)) {
        throw new Error('номер товара должен быть положительным целым числом.');
    }

    const index = Number(normalized) - 1;
    const item = Array.isArray(list) ? list[index] : null;
    if (!item) {
        throw new Error('товар не найден.');
    }

    return { item, index };
}

function canManageAuction(member, guild) {
    if (!member || !guild) return false;
    if (member.id === guild.ownerId) return true;
    return member.permissions.has('Administrator');
}

module.exports = { parseAuctionPrice, getAuctionItemByInput, canManageAuction };
