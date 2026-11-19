
// CAMPUS CONNECT - VERSION 2

const API_URL = "https://campus-connect-api-668.campusconnect668.workers.dev";

// 1. MOBILE NAVIGATION

const menuToggle = document.getElementById("menu-toggle");
const navigation = document.getElementById("navigation");

if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
        navigation.classList.toggle("active");
    });

    document.querySelectorAll("#navigation a").forEach(link => {
        link.addEventListener("click", () => {
            navigation.classList.remove("active");
        });
    });
}

// 2. LOAD ANNOUNCEMENTS AND EVENTS

const newsContainer = document.getElementById("news-container");

function createNewsCard(title, content, category) {
    const card = document.createElement("article");
    card.className = "news-card";
    card.dataset.category = (category || "general").toLowerCase();

    const heading = document.createElement("h3");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = content || "";

    card.append(heading, paragraph);
    return card;
}

async function loadCampusInformation() {
    if (!newsContainer) return;

    try {
        const [announcementResponse, eventResponse] = await Promise.all([
            fetch(`${API_URL}/announcements`),
            fetch(`${API_URL}/events`)
        ]);

        if (!announcementResponse.ok || !eventResponse.ok) {
            throw new Error("Unable to load campus information.");
        }

        const announcements = await announcementResponse.json();
        const events = await eventResponse.json();

        if (announcements.length === 0 && events.length === 0) {
            return;
        }

        newsContainer.replaceChildren();

        announcements.forEach(item => {
            newsContainer.appendChild(
                createNewsCard(
                    item.title,
                    item.content,
                    item.category
                )
            );
        });

        events.forEach(item => {
            const details = [
                item.description,
                item.event_date ? "Date: " + item.event_date : "",
                item.location ? "Location: " + item.location : ""
            ].filter(Boolean).join(" | ");

            newsContainer.appendChild(
                createNewsCard(item.title, details, "events")
            );
        });

        applyFilters();

    } catch (error) {
        console.error("Loading error:", error);
    }
}

// 3. NEWS FILTER AND SEARCH

let activeCategory = "all";
let searchText = "";

function applyFilters() {
    document.querySelectorAll(".news-card, .card").forEach(card => {
        const category = (card.dataset.category || "").toLowerCase();

        const matchesCategory =
            activeCategory === "all" || category === activeCategory;

        const matchesSearch =
            card.textContent.toLowerCase().includes(searchText);

        card.style.display =
            matchesCategory && matchesSearch ? "" : "none";
    });
}

document.querySelectorAll(".filters button").forEach(button => {
    button.addEventListener("click", () => {
        activeCategory = button.dataset.category || "all";
        applyFilters();
    });
});

const searchInput = document.getElementById("search-input");

if (searchInput) {
    searchInput.addEventListener("input", () => {
        searchText = searchInput.value.toLowerCase().trim();
        applyFilters();
    });
}

// 4. STUDENT CONTRIBUTIONS

const contributionForm = document.getElementById("contribution-form");
const formMessage = document.getElementById("form-message");

if (contributionForm && formMessage) {
    contributionForm.addEventListener("submit", async event => {
        event.preventDefault();

        const studentName =
            document.getElementById("student-name").value.trim();

        const studentEmail =
            document.getElementById("student-email").value.trim();

        const title =
            document.getElementById("contribution-title").value.trim();

        const message =
            document.getElementById("contribution-message").value.trim();

        if (!studentName || !studentEmail || !title || !message) {
            formMessage.textContent = "Please complete all fields.";
            return;
        }

        const submitButton =
            contributionForm.querySelector('button[type="submit"]');

        if (submitButton) submitButton.disabled = true;

        formMessage.textContent = "Submitting your contribution...";

        try {
            const response = await fetch(`${API_URL}/contributions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    student_name: studentName,
                    email: studentEmail,
                    message: "Title: " + title + "\n\n" + message
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Submission failed.");
            }

            formMessage.textContent =
                "Thank you, " + studentName +
                "! Your contribution has been submitted successfully.";

            contributionForm.reset();

        } catch (error) {
            formMessage.textContent =
                "Sorry, we could not submit your contribution. Please try again.";

            console.error("Submission error:", error);

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// 5. START WEBSITE

loadCampusInformation();

console.log("Campus Connect Version 2 loaded successfully!");
