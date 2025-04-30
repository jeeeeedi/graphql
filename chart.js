import { fetchGraphQL } from "./script.js";

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

  let chartData = await fetchGraphQL(query);
  console.log("chartData", chartData);
  document.getElementById("graphs").style.display = "block";
  makeGraph(chartData)
  makeChart(chartData);
}
function makeGraph(chartData) {
  // Extract data dynamically from progresses
  const projectData = chartData.data.user[0].progresses.map((progress) => ({
    name: progress.object.name,
    grade: progress.grade,
    updatedAt: progress.updatedAt,
  }));

  // Use projectData for further processing (e.g., rendering the chart)
  const svg = document.getElementById("project-chart");
  const width = svg.clientWidth;
  const height = svg.clientHeight;
  const margin = 40;

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

  // === Draw Y-Axis (grades) ===
  const yTicks = [];
  for (
    let tick = Math.floor(minGrade);
    tick <= Math.ceil(maxGrade);
    tick += 0.5
  ) {
    yTicks.push(tick);
  }
  yTicks.forEach((grade) => {
    const y = scaleY(grade);

    // horizontal grid line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", margin);
    line.setAttribute("x2", width - margin);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#eee");
    svg.appendChild(line);

    // grade label
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    label.setAttribute("x", 5);
    label.setAttribute("y", y + 4);
    label.textContent = grade.toFixed(2);
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
    line.setAttribute("y1", margin);
    line.setAttribute("y2", height - margin);
    line.setAttribute("stroke", "#eee");
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
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    //circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);

    let offsetX = 0;
    if (i > 1) {
      const prev = parsedData[i - 1];
      const dateDiff = Math.round(d.date - prev.date) - 100000;
      const gradeDiff = d.grade - prev.grade;

      // Add 20px offset if the difference exceeds 10
      if (dateDiff < 10000000 && gradeDiff <= 0.1) {
        offsetX = 8;
      }
      circle.setAttribute("cx", x + offsetX);
    } else {
      circle.setAttribute("cx", x);
    }


    circle.setAttribute("r", 4);
    circle.setAttribute("fill", "blue");
    circle.style.cursor = "pointer"; // Make it look clickable
    svg.appendChild(circle);

    // Add click event listener to the dot
    circle.addEventListener("click", () => {
      const projectInfoDiv = document.getElementById("project-info");
      projectInfoDiv.innerHTML = `
        <p><strong>Project Name:</strong> ${d.name}</p>
        <p><strong>Grade:</strong> ${d.grade}</p>
        <p><strong>Completed:</strong> ${new Date(d.date).toLocaleString()}</p>
      `;
      glowFriends(chartData);
    });

    // Draw a line to the previous point
    if (i > 0) {
      const prev = parsedData[i - 1];
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", scaleX(prev.date) + offsetX);
      line.setAttribute("y1", scaleY(prev.grade));
      line.setAttribute("x2", x + offsetX);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "#aaa");
      svg.appendChild(line);
    }
  });
}
function glowFriends(chartData) {
   // Highlight group members in the user-chart
   const userChart = document.getElementById("user-chart");
   const groupMembers = d.group.members.map((member) => member.userLogin);
 
   // Reset all circles in user-chart
   const userCircles = userChart.querySelectorAll("circle");
   userCircles.forEach((circle) => {
     circle.setAttribute("fill", "black"); // Default color
     circle.setAttribute("stroke", "none"); // Remove highlight
   });
 
   // Highlight circles for group members
   groupMembers.forEach((member) => {
     const memberCircle = Array.from(userCircles).find((circle) => {
       const text = userChart.querySelector(
         `text[x="${circle.getAttribute("cx")}"][y="${circle.getAttribute("cy")}"]`
       );
       return text && text.textContent === member;
     });
 
     if (memberCircle) {
       memberCircle.setAttribute("fill", "red"); // Highlight color
       memberCircle.setAttribute("stroke", "yellow"); // Add stroke for emphasis
       memberCircle.setAttribute("stroke-width", "2");
     }
   });
}
function makeChart(chartData) {
  const memberData = chartData.data.user[0].progresses.map((progress) => ({
    name: progress.object.name,
    members: progress.group.members,
  }));
  console.log(memberData);

  const myLogin = chartData.data.user[0].login;

  // Extract unique userLogins
  const friends = memberData
    .flatMap((data) => data.members.map((member) => member.userLogin))
    .filter((userLogin) => userLogin !== myLogin) // Exclude current user's login
    .reduce((counts, userLogin) => {
      counts[userLogin] = (counts[userLogin] || 0) + 1;
      return counts;
    }, {});

  // Convert to an array of unique userLogins with their counts
  const friendsWithCounts = Object.entries(friends).map(
    ([userLogin, count]) => ({ userLogin, count })
  );

  console.log(friendsWithCounts);

  // Create SVG circles
  const svg = document.getElementById("user-chart");
  const width = svg.clientWidth;
  const height = svg.clientHeight;

  const maxCount = Math.max(...friendsWithCounts.map((u) => u.count));
  const minRadius = 40; // Minimum circle radius
  const maxRadius = friendsWithCounts.length * 10; // Maximum circle radius

  const circles = [];

  friendsWithCounts.forEach((user, index) => {
    const radius =
      minRadius + ((user.count / maxCount) * (maxRadius - minRadius));

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
        angle += Math.PI / 6; // Increment angle to try a new position
        if (angle >= 2 * Math.PI) {
          angle = 0;
          distance += 5; // Increase distance if no valid position is found
        }

        const lastCircle = circles[circles.length - 1];
        x = lastCircle.x + Math.cos(angle) * distance;
        y = lastCircle.y + Math.sin(angle) * distance;

        // Ensure the circle stays within bounds
        x = Math.max(radius, Math.min(x, width - radius));
        y = Math.max(radius, Math.min(y, height - radius));

        isOverlapping = circles.some((circle) => {
          const dx = circle.x - x;
          const dy = circle.y - y;
          const distanceBetween = Math.sqrt(dx * dx + dy * dy);
          return distanceBetween < circle.radius + radius; // Check if circles overlap
        });
      } while (isOverlapping);
    }

    // Save the circle's position and radius
    circles.push({ x, y, radius });

    // Create circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", radius);
    svg.appendChild(circle);

    // Add text inside the circle
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y + 5); // Adjust text position
    text.setAttribute("text-anchor", "middle");
    text.textContent = user.userLogin;
    svg.appendChild(text);
  });
}