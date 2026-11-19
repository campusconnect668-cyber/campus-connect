
// CAMPUS CONNECT - WEBSITE FUNCTIONALITY

// 1. MOBILE NAVIGATION

const menuToggle = document.getElementById("menu-toggle");
const navigation = document.getElementById("navigation");

menuToggle.addEventListener("click", function () {
    navigation.classList.toggle("active");
});

// Close menu after clicking a navigation link

document.querySelectorAll("#navigation a").forEach(link => {
    link.addEventListener("click", function () {
        navigation.classList.remove("active");
    });
});


// 2. NEWS CATEGORY FILTER

const filterButtons = document.querySelectorAll(
    ".filters button"
);

const newsCards = document.querySelectorAll(".news-card");

filterButtons.forEach(button => {
    button.addEventListener("click", function () {

        const category = this.dataset.category;

        newsCards.forEach(card => {

            if (
                category === "all" ||
                card.dataset.category === category
            ) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }

        });

    });
});


// 3. CAMPUS INFORMATION SEARCH

const searchInput = document.getElementById("search-input");

searchInput.addEventListener("input", function () {

    const searchText = this.value.toLowerCase();

    const searchableItems = document.querySelectorAll(
        ".card, .news-card"
    );

    searchableItems.forEach(item => {

        const content = item.textContent.toLowerCase();

        if (content.includes(searchText)) {
            item.style.display = "block";
        } else {
            item.style.display = "none";
        }

    });

});


// 4. CONTRIBUTION FORM

const contributionForm = document.getElementById(
    "contribution-form"
);

const formMessage = document.getElementById("form-message");

contributionForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const studentName = document.getElementById(
        "student-name"
    ).value.trim();

    const title = document.getElementById(
        "contribution-title"
    ).value.trim();

    const message = document.getElementById(
        "contribution-message"
    ).value.trim();

    if (!studentName || !title || !message) {
        formMessage.textContent =
            "Please complete all fields.";

        return;
    }

    formMessage.textContent =
        "Thank you, " + studentName +
        "! Your contribution has been received in this demo. " +
        "It has not been sent to a server.";

    contributionForm.reset();

});


// 5. WELCOME MESSAGE

console.log("Welcome to Campus Connect!");

console.log("Campus Connect website loaded successfully.");
