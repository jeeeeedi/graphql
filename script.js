import { fetchChartData } from "./chart.js";

const API_URL = "https://01.gritlab.ax";

// DOM helpers
export function toggleVisibility(elementId, visible) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = visible ? "block" : "none";
  }
}

// Alert message
function setMessage(message) {
  const messageElement = document.getElementById("message");
  messageElement.innerText = message;
  // Clear after 3 seconds
  setTimeout(() => {
    messageElement.innerText = "";
  }, 3000);
}

// Authentication functions
async function login(e) {
  e.preventDefault();

  const usernameOrEmail = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!usernameOrEmail || !password) {
    setMessage("Please provide both username/email and password.");
    return;
  }

  try {
    // Encode credentials in Base64 for Basic Authentication
    const credentials = btoa(`${usernameOrEmail}:${password}`);
    const res = await fetch(`${API_URL}/api/auth/signin`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        setMessage("Invalid credentials. Please try again.");
      } else {
        setMessage("Failed to login. Please try later.");
      }
      return;
    }

    const accessToken = await res.json();
    localStorage.setItem("accessToken", accessToken);
    setMessage("Logged in!");

    toggleVisibility("logout-button", true);
    toggleVisibility("login-form", false);
    toggleVisibility("welcome", true);
    toggleVisibility("stats", true);
    toggleVisibility("graphs", true);

    // Fetch user data after login
    const query = `
        query {
          user {
            id
            login
          }
        }
        `;

    await fetchGraphQL(query);
    await fetchStats();
    await fetchChartData();
  } catch (error) {
    console.error("Login failed:", error);
    setMessage("Login error occurred!");
  }
}

export async function fetchGraphQL(query) {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    setMessage("Please log in first");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/graphql-engine/v1/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        setMessage("Session expired. Please log in again.");
        logout();
      } else {
        setMessage("Failed to fetch data.");
      }
      return;
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error in fetchGraphQL:", error);
    setMessage("Error occurred while fetching data.");
  }
}

export function logout() {
  localStorage.removeItem("accessToken");
  toggleVisibility("logout-button", false);
  toggleVisibility("login-form", true);
  toggleVisibility("welcome", false);
  toggleVisibility("stats", false);
  toggleVisibility("graphs", false);
  setMessage("Logged out!");
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Setup login listener
  document.getElementById("login-form").addEventListener("submit", login);

  // If we already have a token, attempt to use it
  const accessToken = localStorage.getItem("accessToken");
  if (accessToken) {
    try {
      await fetchSecret();
      toggleVisibility("login-form", false);
      toggleVisibility("logout-button", true);
    } catch (error) {
      // If the token is invalid, reset everything
      logout();
    }
  }

  // Hide the loader, show content
  toggleVisibility("loader", false);
  toggleVisibility("auth", true);
});

// Expose logout globally
window.logout = logout;

async function fetchStats() {
  const query = `
        query {
            user {
              id
              login
              firstName
              lastName
              auditRatio
            }
            transaction_aggregate(
              where: {
                type: { _eq: "xp" },
                event: { id: { _eq: 104 } }
              }
            ) {
              aggregate {
              count
                sum {
                  amount
                }
              }
            }
        }
    `;

  let stats = await fetchGraphQL(query);
  document.getElementById(
    "welcome"
  ).textContent = `Welcome ${stats.data.user[0].login}!`;
  toggleVisibility("stats", true);
  document.getElementById("user").innerHTML = `
  Username: ${stats.data.user[0].login}</br></br>
  User ID: ${stats.data.user[0].id}</br></br>
  First Name: ${stats.data.user[0].firstName}</br></br>
  Last Name: ${stats.data.user[0].lastName}</br></br>
  `;

  document.getElementById("xp").textContent =
    Math.ceil(stats.data.transaction_aggregate.aggregate.sum.amount / 1000) +
    " kB";
  document.getElementById("transactions-count").textContent =
    stats.data.transaction_aggregate.aggregate.count;

  document.getElementById("audit-ratio").textContent =
    Math.round(stats.data.user[0].auditRatio * 10) / 10;
}