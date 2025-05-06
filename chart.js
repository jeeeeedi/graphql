import { fetchGraphQL, toggleVisibility } from "./script.js";

let chartData = {};
let projectData = {};
let members = {};

export async function fetchChartData() {
  const query = `
    {
      user {
      login
        progresses(where: {object: {type: {_eq: "project"}}}) {
          object {
            name
          }
          grade
          createdAt
          updatedAt
          group {
            members {
              userLogin
            }
          }
        }
      }
    }
    `;

  chartData = await fetchGraphQL(query);
  toggleVisibility("graphs", true);

  makeGraph(chartData);
  makeChart(chartData);
}
function makeGraph(chartData) {
  // Extract data dynamically from progresses
  projectData = chartData.data.user[0].progresses.map((progress) => ({
    name: progress.object.name,
    grade: progress.grade,
    createdAt: progress.createdAt,
    updatedAt: progress.updatedAt,
    members: progress.group.members,
  }));

  // Use projectData for further processing (e.g., rendering the chart)
  const svg = document.getElementById("project-chart");
  const width = svg.clientWidth;
  const height = svg.clientHeight;
  const margin = 80;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Parse dates
  const parsedData = projectData.map((d) => ({
    ...d,
    date: new Date(d.updatedAt).getTime(),
  }));
  parsedData.sort((a, b) => a.date - b.date);
  const minDate = parsedData[0].date;
  const maxDate = parsedData[parsedData.length - 1].date;
  const minGrade =
    Math.floor(Math.min(...parsedData.map((d) => d.grade)) * 10) / 10;
  const maxGrade =
    Math.ceil(Math.max(...parsedData.map((d) => d.grade)) * 10) / 10;

  // Scaling functions
  function scaleX(date) {
    return (
      margin + ((date - minDate) / (maxDate - minDate)) * (width - 2 * margin)
    );
  }
  function scaleY(grade) {
    return (
      height -
      margin -
      ((grade - minGrade) / (maxGrade - minGrade)) * (height - 2 * margin)
    );
  }
  // Clear existing SVG content
  svg.innerHTML = "";

  // === Draw Y-Axis (grades) ===
  const yTicks = [];
  const tickStep = 0.5; // Fixed increment for grade ticks

  // Start from the desired minimum value (0 in this case); end 0.5 after maxGrade
  for (let tick = 0; tick <= maxGrade + 0.5; tick += tickStep) {
    yTicks.push(tick);
  }

  yTicks.forEach((grade) => {
    const y = scaleY(grade);

    // horizontal grid line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 40);
    line.setAttribute("x2", width - 40);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);

    svg.appendChild(line);

    // grade label
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    label.setAttribute("x", 5);
    label.setAttribute("y", y + 4);
    label.textContent = grade.toFixed(1);
    svg.appendChild(label);
  });

  // === Draw X-Axis (months) ===
  const start = new Date(minDate);
  const end = new Date(maxDate);
  start.setDate(1); // start of month
  end.setDate(1);
  end.setMonth(end.getMonth() + 1);

  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const x = scaleX(d.getTime());

    // vertical grid line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x);
    line.setAttribute("x2", x);
    line.setAttribute("y1", 40);
    line.setAttribute("y2", height - 40);
    svg.appendChild(line);

    // month label
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );

    label.setAttribute("x", x + 2);
    label.setAttribute("y", height - 5);
    label.textContent = d.toLocaleString("default", {
      month: "short",
      year: "2-digit",
    });
    svg.appendChild(label);
  }

  // === Plot data points ===
  parsedData.forEach((d, i) => {
    const x = scaleX(d.date);
    const y = scaleY(d.grade);
    // Create a point (dot)
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    //circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);

    let offsetX = 0;
    if (i > 1) {
      const prev = parsedData[i - 1];
      const dateDiff = Math.round(d.date - prev.date) - 100000;
      const gradeDiff = d.grade - prev.grade;

      // Add 20px offset if the difference exceeds 10 (in cases where the dates are the same)
      if (dateDiff < 10000000 && gradeDiff <= 0.1) {
        offsetX = 4;
      }
      circle.setAttribute("cx", x + offsetX);
    } else {
      circle.setAttribute("cx", x);
    }

    const randomColor = `hsl(${Math.random() * 360}, 80%, 80%)`; // Generate a random pastel color
    circle.setAttribute("fill", randomColor); // Apply the random color
    svg.appendChild(circle);

    // Add click event listener to the dot
    circle.addEventListener("click", () => {
      const projectInfoDiv = document.getElementById("project-info");
      const roundGrade = d.grade ? parseFloat(d.grade.toFixed(2)) : 0;
      toggleVisibility("project-info", true);

      projectInfoDiv.innerHTML = `
        <p><strong>Project Name:</strong> ${d.name}</p>
        <p><strong>Grade:</strong> ${roundGrade}</p>
        <p><strong>Completed / Last Updated Date:</strong> ${new Date(d.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}, ${new Date(d.date).toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })}</p>
      `;
      findMembers(d.name, d.members, randomColor);
    });

    // Draw a line to the previous point
    if (i > 0) {
      const prev = parsedData[i - 1];
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", scaleX(prev.date) + offsetX);
      line.setAttribute("y1", scaleY(prev.grade));
      line.setAttribute("x2", x + offsetX);
      line.setAttribute("y2", y);
      svg.appendChild(line);
    }
  });
}
function findMembers(projectName, groupMembers, randomColor) {
  // Highlight group members in the member-chart
  const userChart = document.getElementById("member-chart");

  // Reset all circles in member-chart
  const userCircles = userChart.querySelectorAll("circle");
  userCircles.forEach((circle) => {
    circle.setAttribute("fill", "#222"); // Default color
    circle.setAttribute("stroke", "none"); // Remove highlight
  });

  // Highlight circles for group members
  Object.keys(members).forEach((member) => {
    const memberCircle = userChart.querySelector(
      `circle[id="${member}"]`
    );
    const memberText = userChart.querySelector(
      `text[id="${member}"]`
    );

    // Check if the member is in groupMembers
    const isGroupMember = groupMembers.some(
      (groupMember) => groupMember.userLogin === member
    );

    if (isGroupMember) {
      if (memberCircle) {
        memberCircle.setAttribute("fill", randomColor); // Highlight color
      }

      if (memberText) {
        memberText.setAttribute("fill", "black"); // Set text color to black
      }
    } else {
      if (memberText) {
        memberText.setAttribute("fill", "white"); // Reset to white
      }
    }
  });
}
function makeChart(chartData) {
  const memberData = chartData.data.user[0].progresses.map((progress) => ({
    name: progress.object.name,
    members: progress.group.members,
  }));

  // Extract unique userLogins
  members = memberData
    .flatMap((data) => data.members.map((member) => member.userLogin))
    .reduce((counts, userLogin) => {
      counts[userLogin] = (counts[userLogin] || 0) + 1;
      return counts;
    }, {});
  // Convert to an array of unique userLogins with their counts
  const membersWithCount = Object.entries(members).map(
    ([userLogin, count]) => ({ userLogin, count })
  );

  // Create SVG circles
  const svg = document.getElementById("member-chart");
  const width = svg.clientWidth;
  const height = svg.clientHeight;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // Parse dates and calculate scales
  const parsedData = chartData.data.user[0].progresses.map((progress) => ({
    ...progress,
    date: new Date(progress.updatedAt).getTime(),
  }));
  parsedData.sort((a, b) => a.date - b.date);

  // Clear existing SVG content
  svg.innerHTML = "";

  const maxCount = Math.max(...membersWithCount.map((u) => u.count));
  const minRadius = 50; // Minimum circle radius
  const maxRadius = membersWithCount.length * 15; // Maximum circle radius

  const circles = [];

  membersWithCount.forEach((user) => {
    const radius =
      minRadius + (user.count / maxCount) * (maxRadius - minRadius);

    let x, y;
    let isOverlapping;

    // Place the first circle at the center
    if (circles.length === 0) {
      x = width / 2;
      y = height / 2;
    } else {
      // Try to place the circle near existing circles
      let angle = 0;
      let distance = radius * 2; // Start with a distance equal to the diameter
      do {
        x = width / 2 + Math.cos(angle) * distance; // Calculate x based on angle and distance
        y = height / 2 + Math.sin(angle) * distance; // Calculate y based on angle and distance

        // Ensure the circle stays within bounds
        x = Math.max(radius, Math.min(x, width - radius));
        y = Math.max(radius, Math.min(y, height - radius));

        isOverlapping = circles.some((circle) => {
          const dx = circle.x - x;
          const dy = circle.y - y;
          const distanceBetween = Math.sqrt(dx * dx + dy * dy);
          return distanceBetween < circle.radius + radius; // Check if circles overlap
        });

        angle += Math.PI / 12; // Increment angle for clockwise rotation
        if (angle >= 2 * Math.PI) {
          angle -= 2 * Math.PI; // Keep angle within 0 to 2π
          distance += 10; // Gradually increase the distance for the spiral effect
        }
      } while (isOverlapping);
    }

    // Save the circle's position and radius
    circles.push({ x, y, radius });

    // Create circle
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );

    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", radius);
    circle.setAttribute("id", user.userLogin); // Add id with user's login
    circle.setAttribute("fill", "#222")
    svg.appendChild(circle);

    // Add text inside the circle
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y + 5); // Adjust text position
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "white");
    text.setAttribute("id", user.userLogin);
    text.textContent = user.userLogin;
    svg.appendChild(text);
  });
}
