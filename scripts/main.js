console.log("yt/tiktok=@michaeloney0");

const gameOptions = [
    "Go",
    "Home",
    "Champions",
    "Legends Arceus",
    "Mystery Dungeon Rescue Team",
    "Sword and Shield",
];

function getVotes() {
    const votes = JSON.parse(localStorage.getItem('triviaVotes')) || {};
    gameOptions.forEach(game => {
        if (!(game in votes)) votes[game] = 0;
    });
    return votes;
}

function saveVotes(votes) {
    localStorage.setItem('triviaVotes', JSON.stringify(votes));
}

function showPercentages() {
    const votes = getVotes();
    const total = Object.values(votes).reduce((a, b) => a + b, 0);
    gameOptions.forEach(game => {
        const percent = total ? ((votes[game] / total) * 100).toFixed(1) : 0;
        const span = document.getElementById('percent-' + game.replace('/', '\\/'));
        if (span) span.textContent = `(${percent}%)`;
    });
}

function checkTrivia() {
    const answer = document.querySelector('input[name="game"]:checked');
    const result = document.getElementById('trivia-result');
    if (!answer) {
        result.textContent = "Please select a game!";
        return;
    }
    // Save vote
    const votes = getVotes();
    votes[answer.value]++;
    saveVotes(votes);
    showPercentages();

    if (answer.value === "Red/Blue") {
        result.textContent = "Correct! Pokémon Red/Blue was released first.";
    } else {
        result.textContent = "Incorrect. The correct answer is Pokémon Red/Blue.";
    }
}

// Show percentages on page load
window.addEventListener('DOMContentLoaded', showPercentages);