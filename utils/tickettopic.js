function getOwnerId(topic) {
    const match = topic?.match(/Owner:(\d+)/);
    return match ? match[1] : null;
}

function getClaimerId(topic) {
    const match = topic?.match(/Claimed:(\d+)/);
    return match ? match[1] : null;
}

function getCategory(topic) {
    const match = topic?.match(/Category: ([^|]+)/);
    return match ? match[1].trim() : null;
}

function setClaimerId(topic, claimerId) {
    const base = topic.replace(/ \| Claimed:\d+/, '');
    return claimerId ? `${base} | Claimed:${claimerId}` : base;
}

module.exports = { getOwnerId, getClaimerId, getCategory, setClaimerId };