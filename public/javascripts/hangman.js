const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("")
const MAX_MISTAKES = 6
const ROOT_ELEM = document.getElementById("hangman-root")

const HEART_FILLED =
    "<svg width=\"1em\" height=\"1em\" viewBox=\"0 0 16 16\" class=\"bi bi-suit-heart-fill\" fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\">\n" +
    "  <path d=\"M4 1c2.21 0 4 1.755 4 3.92C8 2.755 9.79 1 12 1s4 1.755 4 3.92c0 3.263-3.234 4.414-7.608 9.608a.513.513 0 0 1-.784 0C3.234 9.334 0 8.183 0 4.92 0 2.755 1.79 1 4 1z\"/>\n" +
    "</svg>"

const HEART_EMPTY =
    "<svg width=\"1em\" height=\"1em\" viewBox=\"0 0 16 16\" class=\"bi bi-suit-heart\" fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\">\n" +
    "  <path fill-rule=\"evenodd\" d=\"M8 6.236l.894-1.789c.222-.443.607-1.08 1.152-1.595C10.582 2.345 11.224 2 12 2c1.676 0 3 1.326 3 2.92 0 1.211-.554 2.066-1.868 3.37-.337.334-.721.695-1.146 1.093C10.878 10.423 9.5 11.717 8 13.447c-1.5-1.73-2.878-3.024-3.986-4.064-.425-.398-.81-.76-1.146-1.093C1.554 6.986 1 6.131 1 4.92 1 3.326 2.324 2 4 2c.776 0 1.418.345 1.954.852.545.515.93 1.152 1.152 1.595L8 6.236zm.392 8.292a.513.513 0 0 1-.784 0c-1.601-1.902-3.05-3.262-4.243-4.381C1.3 8.208 0 6.989 0 4.92 0 2.755 1.79 1 4 1c1.6 0 2.719 1.05 3.404 2.008.26.365.458.716.596.992a7.55 7.55 0 0 1 .596-.992C9.281 2.049 10.4 1 12 1c2.21 0 4 1.755 4 3.92 0 2.069-1.3 3.288-3.365 5.227-1.193 1.12-2.642 2.48-4.243 4.38z\"/>\n" +
    "</svg>"

const THIN_SPACE = "&thinsp;"

function renderLife(numMistakes, numRemaining) {
    const life = HEART_FILLED.repeat(numRemaining) + HEART_EMPTY.repeat(numMistakes)
    return `
        <div class="hangman-life row">
            <h3 class="col text-center">${life}</h3>
        </div>`
}

function renderBlanks(blanks) {
    return `
        <div class="hangman-blanks row">
            <h2 class="col text-center">${blanks.split("").map(l => {
                    return `<span style="text-decoration-line:underline">${l}</span>`
                }).join(THIN_SPACE)}
            </h2>
        </div>`
}

function renderMistakes(mistakes) {
    return `
        <div class="hangman-mistakes row">
            <h3 class="col text-center">${mistakes.length === 0 ? "&nbsp;" : mistakes.join(THIN_SPACE)}</h3>
        </div>`
}

function renderState({blanks, mistakes}) {
    const numMistakes = mistakes.length
    const numRemaining = MAX_MISTAKES - numMistakes
    return `
        ${renderLife(numMistakes, numRemaining)}
        ${renderBlanks(blanks)}
        ${renderMistakes(mistakes)}`
}

function renderOutcome({outcome, solution, explanation}) {
    let message
    switch (outcome) {
        case "freedom":
            message = "You win!"
            break
        case "death":
            message = `You lose! The solution was '${solution}'`
            break
        case "mistrial":
            message = `Mistrial: ${explanation}`
            break
        default:
            message = ""
    }
    if (message !== "") return `
        <div class="hangman-outcome d-flex flex-column align-items-center justify-content-center">
            <h3 class="text-center">${message}</h3>
            <div>
                <button type="button" class="btn btn-primary" onclick="resetHangman()">Try again</button>
            </div>
        </div>`
    else return ""
}

function renderButton(letter, handler, disabled=false) {
    return `
        <button
            type="button"
            ${disabled ? "disabled" : ""}
            class="hangman-button btn btn-block ${disabled ? "btn-secondary" : "btn-primary"}"
            onclick="${handler}('${letter}')"
        >
            ${letter.toUpperCase()}
        </button>`
}

function renderControls({state, outcome}) {
    function isDisabled(letter) {
        return outcome !== undefined
            || state.blanks.includes(letter)
            || state.mistakes.includes(letter)
    }

    const buttons = ALPHABET.map(l => `<td>${renderButton(l, "postGuess", isDisabled(l))}</td>`)
    const buttonRows = [[], [], [], []]
    for (const [i, button] of buttons.entries()) {
        buttonRows[Math.floor(i / 7)].push(button)
    }
    const tableRows = buttonRows.map(br => `<tr>${br.join("")}</tr>`)
    return `<table class="table table-sm table-borderless button-grid">${tableRows.join("")}</table>`
}

function renderHangman(hangman) {
    return `
        <h1 class="text-center">Hangman</h1>
        ${renderState(hangman.state)}
        ${renderControls(hangman)}
        ${renderOutcome(hangman)}`
}


let hangman

let secretWord = "vulvas"

function updateHangman() {
    ROOT_ELEM.innerHTML = renderHangman(hangman)
}

function resetHangman() {
    hangman = {
        state: {
            blanks: "______",
            mistakes: []
        }
    }
    updateHangman()
}

function postGuess(letter) {
    const data = {
        state: hangman.state,
        guess: letter
    }
    fetch(`${location.origin}/guess`, {
        method: "POST",
        body: JSON.stringify(data),
        credentials: "same-origin",
        headers: {
            "Content-Type": "text/json",
            "Csrf-Token": "nocheck",
        }
    }).then(response => {
        if (!response.ok) {
            console.error(response.status)
            console.error(response.statusText)
            response.text().then(txt => console.error(txt))
        } else {
            response.json().then(json => {
                hangman = json
                updateHangman()
            }).catch(err => console.error(err))
        }
    }).catch(err => console.error(err))
}

function handleGuess(letter) {
    console.log(`Clicked '${letter}'`)
    if (secretWord.includes(letter)) {
        let newBlanks = ""
        let numEmpty = 0
        for (let i = 0; i < secretWord.length; i++) {
            if (secretWord.charAt(i) === letter)
                newBlanks += letter
            else {
                newBlanks += hangman.state.blanks.charAt(i)
            }
        }
        hangman.state.blanks = newBlanks
        if (!newBlanks.includes('_')) {
            hangman.outcome = "freedom"
            hangman.solution = newBlanks
        }
    } else {
        hangman.state.mistakes.push(letter)
        if (hangman.state.mistakes.length >= MAX_MISTAKES) {
            hangman.outcome = "death"
            hangman.solution = secretWord
        }
    }
    updateHangman()
}

if (ROOT_ELEM !== null) {
    resetHangman()
}